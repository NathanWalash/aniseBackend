// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require('express'); // Web framework for Node.js
const cors = require('cors'); // Middleware to enable Cross-Origin Resource Sharing
const gocardless = require('gocardless-pro-node');
const path = require('path');
const fetch = require('node-fetch');
const admin = require('firebase-admin');
const fs = require('fs');

// Create an Express application
const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for all routes (allows requests from any origin)
app.use(cors());

// Parse incoming JSON requests (so req.body is populated)
app.use(express.json()); // Use built-in JSON parser

// Serve static files (for the test HTML page)
app.use(express.static(__dirname));

// Log the GoCardless access token and environment (for debugging)
console.log('GOCARDLESS_ACCESS_TOKEN:', process.env.GOCARDLESS_ACCESS_TOKEN);
console.log('GOCARDLESS_ENVIRONMENT:', process.env.GOCARDLESS_ENVIRONMENT);

// Initialize the GoCardless client with your access token and environment
const client = new gocardless.Client({
  access_token: process.env.GOCARDLESS_ACCESS_TOKEN,
  environment: 'sandbox'
});

console.log('GoCardless client initialized.');

// Store flow data in memory (simple approach)
let flowData = {};

// Initialize Firebase Admin SDK
let db = null;
try {
  // Read service account key from file
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  db = admin.firestore();
  console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.log('Firebase Admin SDK not initialized. Some features may not work.');
  console.log('Error:', error.message);
}

// Middleware to verify user authorization
const verifyUser = async (req, res, next) => {
  try {
    const { userId } = req.body || req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    // In a real app, you'd verify the user's JWT token here
    // For now, we'll add basic validation
    if (!userId || typeof userId !== 'string' || userId.length < 10) {
      return res.status(401).json({ error: 'Invalid user ID' });
    }

    // Store the verified userId for the route to use
    req.verifiedUserId = userId;
    next();
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// 1. Start redirect flow
app.post('/api/start-redirect-flow', async (req, res) => {
  try {
    const { name, email } = req.body;
    const session_token = Math.random().toString(36).substring(2);

    // Split name into first and last name
    const nameParts = name.trim().split(' ');
    const given_name = nameParts[0] || '';
    const family_name = nameParts.slice(1).join(' ') || '';

    const redirectFlow = await client.redirect_flows.create({
      description: "Direct Debit Setup",
      session_token,
      success_redirect_url: `http://192.168.0.188:3001/success?session_token=${session_token}`,
      prefilled_customer: { 
        given_name, 
        family_name,
        email 
      }
    });

    // Store flow data
    flowData[session_token] = {
      redirect_flow_id: redirectFlow.redirect_flows.id,
      session_token
    };

    res.json({
      redirect_url: redirectFlow.redirect_flows.redirect_url,
      redirect_flow_id: redirectFlow.redirect_flows.id,
      session_token,
    });
  } catch (err) {
    console.error('Error starting redirect flow:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2. Confirm redirect flow
app.post('/api/confirm-redirect-flow', async (req, res) => {
  try {
    const { redirect_flow_id, session_token } = req.body;
    
    console.log('Confirming redirect flow:', { redirect_flow_id, session_token });

    // Use direct HTTP request to bypass SDK data envelope issues
    const response = await fetch(`https://api-sandbox.gocardless.com/redirect_flows/${redirect_flow_id}/actions/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'GoCardless-Version': '2015-07-06'
      },
      body: JSON.stringify({
        data: {
          session_token: session_token
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`GoCardless API error: ${JSON.stringify(errorData)}`);
    }
    
    const confirmedFlow = await response.json();
    const mandate_id = confirmedFlow.redirect_flows.links.mandate;
    const customer_id = confirmedFlow.redirect_flows.links.customer;

    // Store mandate data
    if (flowData[session_token]) {
      flowData[session_token].mandate_id = mandate_id;
      flowData[session_token].customer_id = customer_id;
    }

    res.json({
      mandate_id,
      customer_id,
      redirect_flow_id
    });
  } catch (err) {
    console.error('Error confirming redirect flow:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. Create payment
app.post('/api/create-payment', async (req, res) => {
  try {
    const { amount, currency, mandate_id } = req.body;
    
    console.log('Creating payment:', { amount, currency, mandate_id });

    const payment = await client.payments.create({
      amount: parseInt(amount),
      currency: currency.toUpperCase(),
      links: {
        mandate: mandate_id
      },
      metadata: {
        source: 'test-payment'
      }
    });

    res.json({
      payment_id: payment.payments.id,
      status: payment.payments.status,
      amount: payment.payments.amount,
      currency: payment.payments.currency
    });
  } catch (err) {
    console.error('Error creating payment:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 4. Create subscription
app.post('/api/create-subscription', async (req, res) => {
  try {
    const { amount, currency, mandate_id, interval_unit, interval, name } = req.body;
    
    console.log('Creating subscription:', { amount, currency, mandate_id, interval_unit, interval, name });

    const subscription = await client.subscriptions.create({
      amount: parseInt(amount),
      currency: currency.toUpperCase(),
      interval_unit,
      interval: parseInt(interval),
      links: {
        mandate: mandate_id
      },
      metadata: {
        name: name || 'test-subscription'
      }
    });

    res.json({
      subscription_id: subscription.subscriptions.id,
      status: subscription.subscriptions.status,
      amount: subscription.subscriptions.amount,
      currency: subscription.subscriptions.currency,
      interval_unit: subscription.subscriptions.interval_unit,
      interval: subscription.subscriptions.interval
    });
  } catch (err) {
    console.error('Error creating subscription:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 5. List subscriptions
app.get('/api/subscriptions', async (req, res) => {
  try {
    // Fetch subscriptions from GoCardless
    const response = await fetch('https://api-sandbox.gocardless.com/subscriptions', {
      headers: {
        'Authorization': `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
        'GoCardless-Version': '2015-07-06'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GoCardless API error: ${response.status}`);
    }
    
    const data = await response.json();
    const subscriptions = data.subscriptions || [];
    
    res.json(subscriptions);
  } catch (err) {
    console.error('Error fetching subscriptions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 6. Webhook handler for GoCardless events
app.post('/api/webhook', async (req, res) => {
  try {
    const { events } = req.body;
    
    console.log('Received webhook events:', events.length);
    
    for (const event of events) {
      const { resource_type, action, links } = event;
      
      console.log(`Processing ${resource_type} ${action} event`);
      
      // Handle payment events
      if (resource_type === 'payments') {
        if (action === 'confirmed') {
          // Payment successful - update Firebase
          await handlePaymentSuccess(links.payment);
        } else if (action === 'failed') {
          // Payment failed - update Firebase
          await handlePaymentFailure(links.payment);
        }
      }
      
      // Handle subscription events
      if (resource_type === 'subscriptions') {
        if (action === 'created') {
          // Subscription created - update Firebase
          await handleSubscriptionCreated(links.subscription);
        } else if (action === 'cancelled') {
          // Subscription cancelled - update Firebase
          await handleSubscriptionCancelled(links.subscription);
        }
      }
    }
    
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Helper functions for webhook processing
async function handlePaymentSuccess(paymentId) {
  try {
    // Get payment details from GoCardless
    const response = await fetch(`https://api-sandbox.gocardless.com/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
        'GoCardless-Version': '2015-07-06'
      }
    });
    
    if (response.ok) {
      const payment = await response.json();
      
      // Here you would update Firebase with payment success
      // For now, just log it
      console.log('Payment successful:', payment.payments.id, payment.payments.amount);
      
      // TODO: Update Firebase user subscription status
      // await updateUserSubscriptionStatus(payment.payments.links.subscription, 'active');
    }
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

async function handlePaymentFailure(paymentId) {
  try {
    const response = await fetch(`https://api-sandbox.gocardless.com/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
        'GoCardless-Version': '2015-07-06'
      }
    });
    
    if (response.ok) {
      const payment = await response.json();
      console.log('Payment failed:', payment.payments.id, payment.payments.failure_reason);
      
      // TODO: Update Firebase user subscription status
      // await updateUserSubscriptionStatus(payment.payments.links.subscription, 'failed');
    }
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

async function handleSubscriptionCreated(subscriptionId) {
  console.log('Subscription created:', subscriptionId);
  // TODO: Update Firebase with new subscription
}

async function handleSubscriptionCancelled(subscriptionId) {
  console.log('Subscription cancelled:', subscriptionId);
  // TODO: Update Firebase subscription status to cancelled
}

// Success page
app.get('/success', (req, res) => {
  const { session_token } = req.query;
  res.send(`
    <html>
      <head><title>Success</title></head>
      <body>
        <h1>✅ GoCardless Form Completed!</h1>
        <p>Session Token: ${session_token}</p>
        <p>You can now confirm the redirect flow to get your mandate ID.</p>
        <a href="/">Back to Test Page</a>
      </body>
    </html>
  `);
});

// Main test page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>GoCardless Test</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .step { border: 2px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .step.completed { border-color: #28a745; background-color: #f8fff9; }
            .step.current { border-color: #007bff; background-color: #f8f9ff; }
            button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
            button:hover { background: #0056b3; }
            .result { margin-top: 10px; padding: 10px; border-radius: 5px; }
            .success { background: #d4edda; color: #155724; }
            .error { background: #f8d7da; color: #721c24; }
            .info { background: #d1ecf1; color: #0c5460; }
            input, select { width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px; }
            .form-group { margin: 15px 0; }
            .code { background: #f8f9fa; padding: 5px; border-radius: 3px; font-family: monospace; }
        </style>
    </head>
    <body>
        <h1>🧪 GoCardless Test</h1>
        
        <div class="step" id="step1">
            <h3>Step 1: Start Redirect Flow</h3>
            <p>Create a new Direct Debit setup flow.</p>
            <button onclick="startFlow()">🚀 Start New Flow</button>
            <div id="step1Result"></div>
        </div>

        <div class="step" id="step2">
            <h3>Step 2: Complete GoCardless Form</h3>
            <p>Fill out the bank details form on GoCardless website.</p>
            <div id="step2Result"></div>
        </div>

        <div class="step" id="step3">
            <h3>Step 3: Confirm Redirect Flow</h3>
            <p>Confirm the flow to create your mandate.</p>
            <button onclick="confirmFlow()">✅ Confirm Flow</button>
            <div id="step3Result"></div>
        </div>

        <div class="step" id="step4">
            <h3>Step 4: Create Payment/Subscription</h3>
            <div class="form-group">
                <label>Type:</label>
                <select id="paymentType">
                    <option value="payment">One-time Payment</option>
                    <option value="subscription">Subscription</option>
                </select>
            </div>
            <div class="form-group">
                <label>Amount (pence):</label>
                <input type="number" id="amount" value="1000" placeholder="1000 = £10.00">
            </div>
            <div class="form-group">
                <label>Name:</label>
                <input type="text" id="name" value="test" placeholder="Payment name">
            </div>
            <div class="form-group">
                <label>Mandate ID:</label>
                <input type="text" id="mandateId" placeholder="Enter mandate ID from step 3">
            </div>
            <button onclick="createPayment()">💰 Create Payment/Subscription</button>
            <div id="step4Result"></div>
        </div>

        <div class="step" id="step5">
            <h3>Step 5: View Subscriptions</h3>
            <button onclick="loadSubscriptions()">📋 Refresh Subscriptions</button>
            <div id="subscriptions"></div>
        </div>

        <script>
            let currentFlowData = null;
            let currentMandateId = null;

            function updateStepStatus() {
                document.querySelectorAll('.step').forEach(el => el.classList.remove('completed', 'current'));
                if (currentFlowData && !currentMandateId) {
                    document.getElementById('step1').classList.add('completed');
                    document.getElementById('step2').classList.add('current');
                } else if (currentMandateId) {
                    document.getElementById('step1').classList.add('completed');
                    document.getElementById('step2').classList.add('completed');
                    document.getElementById('step3').classList.add('completed');
                    document.getElementById('step4').classList.add('current');
                }
            }

            async function startFlow() {
                try {
                    const name = 'John Doe';
                    const email = 'john.doe@example.com';
                    
                    document.getElementById('step1Result').innerHTML = '<div class="info">Starting flow...</div>';
                    
                    const response = await fetch('/api/start-redirect-flow', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email })
                    });

                    const data = await response.json();
                    
                    if (response.ok) {
                        currentFlowData = data;
                        document.getElementById('step1Result').innerHTML = \`
                            <div class="success">
                                ✅ Flow started!<br>
                                <strong>Flow ID:</strong> <span class="code">\${data.redirect_flow_id}</span><br>
                                <strong>Session Token:</strong> <span class="code">\${data.session_token}</span><br>
                                <a href="\${data.redirect_url}" target="_blank" style="color: #007bff;">🌐 Open GoCardless Form</a>
                            </div>
                        \`;
                        updateStepStatus();
                    } else {
                        document.getElementById('step1Result').innerHTML = \`<div class="error">❌ Error: \${data.error}</div>\`;
                    }
                } catch (error) {
                    document.getElementById('step1Result').innerHTML = \`<div class="error">❌ Network error: \${error.message}</div>\`;
                }
            }

            async function confirmFlow() {
                if (!currentFlowData) {
                    document.getElementById('step3Result').innerHTML = '<div class="error">❌ No flow data. Start with Step 1.</div>';
                    return;
                }

                try {
                    document.getElementById('step3Result').innerHTML = '<div class="info">Confirming flow...</div>';
                    
                    const response = await fetch('/api/confirm-redirect-flow', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            redirect_flow_id: currentFlowData.redirect_flow_id,
                            session_token: currentFlowData.session_token
                        })
                    });

                    const data = await response.json();
                    
                    if (response.ok) {
                        currentMandateId = data.mandate_id;
                        document.getElementById('mandateId').value = data.mandate_id;
                        document.getElementById('step3Result').innerHTML = \`
                            <div class="success">
                                ✅ Flow confirmed!<br>
                                <strong>Mandate ID:</strong> <span class="code">\${data.mandate_id}</span><br>
                                <strong>Customer ID:</strong> <span class="code">\${data.customer_id}</span>
                            </div>
                        \`;
                        updateStepStatus();
                    } else {
                        document.getElementById('step3Result').innerHTML = \`<div class="error">❌ Error: \${data.error}</div>\`;
                    }
                } catch (error) {
                    document.getElementById('step3Result').innerHTML = \`<div class="error">❌ Network error: \${error.message}</div>\`;
                }
            }

            async function createPayment() {
                const mandateId = document.getElementById('mandateId').value;
                const amount = parseInt(document.getElementById('amount').value);
                const name = document.getElementById('name').value;
                const paymentType = document.getElementById('paymentType').value;

                if (!mandateId) {
                    document.getElementById('step4Result').innerHTML = '<div class="error">❌ Please enter a mandate ID</div>';
                    return;
                }

                try {
                    document.getElementById('step4Result').innerHTML = '<div class="info">Creating...</div>';
                    
                    const endpoint = paymentType === 'payment' ? '/api/create-payment' : '/api/create-subscription';
                    const body = paymentType === 'payment' ? 
                        { amount, currency: 'GBP', mandate_id: mandateId } :
                        { amount, currency: 'GBP', mandate_id: mandateId, interval_unit: 'monthly', interval: 1, name };

                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });

                    const data = await response.json();

                    if (response.ok) {
                        const id = data.payment_id || data.subscription_id;
                        document.getElementById('step4Result').innerHTML = \`
                            <div class="success">
                                ✅ \${paymentType === 'payment' ? 'Payment' : 'Subscription'} created!<br>
                                <strong>ID:</strong> <span class="code">\${id}</span><br>
                                <strong>Amount:</strong> £\${(amount / 100).toFixed(2)}<br>
                                <strong>Status:</strong> \${data.status}
                            </div>
                        \`;
                        loadSubscriptions();
                    } else {
                        document.getElementById('step4Result').innerHTML = \`<div class="error">❌ Error: \${data.error}</div>\`;
                    }
                } catch (error) {
                    document.getElementById('step4Result').innerHTML = \`<div class="error">❌ Network error: \${error.message}</div>\`;
                }
            }

            async function loadSubscriptions() {
                try {
                    const response = await fetch('/api/subscriptions');
                    const subscriptions = await response.json();

                    const subscriptionsDiv = document.getElementById('subscriptions');
                    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
                        subscriptionsDiv.innerHTML = '<p>No subscriptions found.</p>';
                        return;
                    }

                    let html = '<div style="margin-top: 15px;">';
                    subscriptions.forEach(sub => {
                        html += \`
                            <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
                                <h4>\${sub.name || 'Subscription'}</h4>
                                <p><strong>Amount:</strong> £\${(sub.amount / 100).toFixed(2)}</p>
                                <p><strong>Frequency:</strong> \${sub.interval} \${sub.interval_unit}</p>
                                <p><strong>Status:</strong> \${sub.status}</p>
                                <p><strong>ID:</strong> <span class="code">\${sub.id}</span></p>
                            </div>
                        \`;
                    });
                    html += '</div>';
                    subscriptionsDiv.innerHTML = html;
                } catch (error) {
                    console.error('Error loading subscriptions:', error);
                    document.getElementById('subscriptions').innerHTML = '<p>Error loading subscriptions.</p>';
                }
            }

            // Initialize
            updateStepStatus();
        </script>
    </body>
    </html>
  `);
});

// 7. Cancel subscription
app.post('/api/cancel-subscription', async (req, res) => {
  try {
    const { subscription_id } = req.body;
    
    console.log('Cancelling subscription:', subscription_id);

    const response = await fetch(`https://api-sandbox.gocardless.com/subscriptions/${subscription_id}/actions/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'GoCardless-Version': '2015-07-06'
      },
      body: JSON.stringify({
        data: {}
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`GoCardless API error: ${JSON.stringify(errorData)}`);
    }
    
    const cancelledSubscription = await response.json();
    
    res.json({
      subscription_id: cancelledSubscription.subscriptions.id,
      status: cancelledSubscription.subscriptions.status
    });
  } catch (err) {
    console.error('Error cancelling subscription:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 8. Save payment flow to Firebase
app.post('/api/save-payment-flow', verifyUser, async (req, res) => {
  try {
    const { flowData } = req.body;
    const userId = req.verifiedUserId;
    
    if (!db) {
      return res.status(500).json({ error: 'Firebase not available' });
    }

    await db.collection('users').doc(userId).collection('payments').doc('current_flow').set({
      redirect_flow_id: flowData.redirect_flow_id,
      session_token: flowData.session_token,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      status: 'started'
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving payment flow:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 9. Save mandate to Firebase
app.post('/api/save-mandate', verifyUser, async (req, res) => {
  try {
    const { mandateData } = req.body;
    const userId = req.verifiedUserId;
    
    if (!db) {
      return res.status(500).json({ error: 'Firebase not available' });
    }

    await db.collection('users').doc(userId).collection('payments').doc('mandate').set({
      mandate_id: mandateData.mandate_id,
      customer_id: mandateData.customer_id,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    });

    // Update flow status
    await db.collection('users').doc(userId).collection('payments').doc('current_flow').update({
      mandate_id: mandateData.mandate_id,
      status: 'completed',
      completed_at: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving mandate:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 10. Save subscription to Firebase
app.post('/api/save-subscription', verifyUser, async (req, res) => {
  try {
    const { subscriptionData } = req.body;
    const userId = req.verifiedUserId;
    
    if (!db) {
      return res.status(500).json({ error: 'Firebase not available' });
    }

    await db.collection('users').doc(userId).collection('subscriptions').doc(subscriptionData.subscription_id).set({
      subscription_id: subscriptionData.subscription_id,
      amount: subscriptionData.amount,
      currency: subscriptionData.currency,
      status: subscriptionData.status,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      name: subscriptionData.name
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving subscription:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 11. Get user subscriptions from Firebase
app.get('/api/get-subscriptions', verifyUser, async (req, res) => {
  try {
    const userId = req.verifiedUserId;
    
    if (!db) {
      return res.status(500).json({ error: 'Firebase not available' });
    }

    const subscriptionsSnapshot = await db.collection('users').doc(userId).collection('subscriptions').get();
    
    const subscriptions = [];
    subscriptionsSnapshot.forEach(doc => {
      subscriptions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ subscriptions });
  } catch (err) {
    console.error('Error fetching subscriptions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 12. Update subscription status in Firebase
app.post('/api/update-subscription', verifyUser, async (req, res) => {
  try {
    const { subscriptionId, status } = req.body;
    const userId = req.verifiedUserId;
    
    if (!db) {
      return res.status(500).json({ error: 'Firebase not available' });
    }

    await db.collection('users').doc(userId).collection('subscriptions').doc(subscriptionId).update({
      status: status,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      ...(status === 'cancelled' && { cancelled_at: admin.firestore.FieldValue.serverTimestamp() })
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating subscription:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 13. Get user mandate from Firebase
app.get('/api/get-mandate', verifyUser, async (req, res) => {
  try {
    const userId = req.verifiedUserId;
    if (!db) return res.status(500).json({ error: 'Firebase not available' });

    const mandateDoc = await db.collection('users').doc(userId).collection('payments').doc('mandate').get();
    if (!mandateDoc.exists) {
      return res.status(404).json({ error: 'No mandate found' });
    }
    res.json({ mandate: mandateDoc.data() });
  } catch (err) {
    console.error('Error fetching mandate:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Start the Express server on port 3000
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📋 Single test page: http://localhost:${port}`);
});