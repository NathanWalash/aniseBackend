import { Request, Response } from 'express';
import client from '../utils/gocardlessClient';
import admin from '../firebaseAdmin';
import fetch from 'node-fetch';

const db = admin.firestore();

// Helper to get userId from verified Firebase token
function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user && user.uid ? user.uid : null;
}

export const startRedirectFlow = async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    // Fetch user profile from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    let firstName = '', lastName = '', userEmail = email;
    if (userDoc.exists) {
      const userData = userDoc.data();
      firstName = userData?.firstName || '';
      lastName = userData?.lastName || '';
      userEmail = userData?.email || email;
    } else if (name) {
      const nameParts = name.trim().split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }
    const session_token = Math.random().toString(36).substring(2);
    const redirectFlow = await client.redirectFlows.create({
      description: 'Direct Debit Setup',
      session_token,
      success_redirect_url: process.env.GOCARDLESS_SUCCESS_URL || 'http://localhost:3001/success',
      prefilled_customer: { given_name: firstName, family_name: lastName, email: userEmail }
    });
    // Store flow data in Firestore
    await db.collection('users').doc(userId).collection('payments').doc('current_flow').set({
      redirect_flow_id: redirectFlow.id,
      session_token,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      status: 'started'
    });
    res.json({
      redirect_url: redirectFlow.redirect_url,
      redirect_flow_id: redirectFlow.id,
      session_token,
    });
  } catch (err: any) {
    console.error('Error starting redirect flow:', err.message);
    res.status(500).json({ error: err.message });
  }
};

export const confirmRedirectFlow = async (req: Request, res: Response) => {
  try {
    const { redirect_flow_id, session_token } = req.body;
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    // Use direct HTTP request to bypass SDK data envelope issues
    const response = await fetch(`https://api-sandbox.gocardless.com/redirect_flows/${redirect_flow_id}/actions/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'GoCardless-Version': '2015-07-06'
      },
      body: JSON.stringify({ data: { session_token } })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`GoCardless API error: ${JSON.stringify(errorData)}`);
    }
    const confirmedFlow: any = await response.json();
    const mandate_id = confirmedFlow.redirect_flows.links.mandate;
    const customer_id = confirmedFlow.redirect_flows.links.customer;
    // Store mandate data in Firestore
    await db.collection('users').doc(userId).collection('payments').doc('mandate').set({
      mandate_id,
      customer_id,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    });
    // Also store GoCardless IDs in user's main profile for easy lookup
    await db.collection('users').doc(userId).set({
      gocardless: {
        customer_id,
        mandate_id,
        linked_at: admin.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });
    // Update flow status
    await db.collection('users').doc(userId).collection('payments').doc('current_flow').update({
      mandate_id,
      status: 'completed',
      completed_at: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ mandate_id, customer_id, redirect_flow_id });
  } catch (err: any) {
    console.error('Error confirming redirect flow:', err.message);
    res.status(500).json({ error: err.message });
  }
};

export const createPayment = async (req: Request, res: Response) => {
  try {
    let { amount, currency, mandate_id } = req.body;
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    // If mandate_id not provided, look it up from user's profile
    if (!mandate_id) {
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      mandate_id = userData?.gocardless?.mandate_id;
      if (!mandate_id) {
        res.status(400).json({ error: 'No GoCardless mandate linked to user. Please link your account first.' });
        return;
      }
    }
    const payment = await client.payments.create({
      amount: parseInt(amount),
      currency: currency.toUpperCase(),
      links: { mandate: mandate_id },
      metadata: { source: 'anise-payment' }
    });
    res.json({
      payment_id: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency
    });
  } catch (err: any) {
    console.error('Error creating payment:', err.message);
    res.status(500).json({ error: err.message });
  }
};

export const createSubscription = async (req: Request, res: Response) => {
  try {
    let { amount, currency, mandate_id, interval_unit, interval, name } = req.body;
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    // If mandate_id not provided, look it up from user's profile
    if (!mandate_id) {
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      mandate_id = userData?.gocardless?.mandate_id;
      if (!mandate_id) {
        res.status(400).json({ error: 'No GoCardless mandate linked to user. Please link your account first.' });
        return;
      }
    }
    const subscription = await client.subscriptions.create({
      amount: parseInt(amount),
      currency: currency.toUpperCase(),
      interval_unit,
      interval: parseInt(interval),
      links: { mandate: mandate_id },
      metadata: { name: name || 'anise-subscription' }
    });
    // Store subscription in Firestore
    await db.collection('users').doc(userId).collection('subscriptions').doc(subscription.id).set({
      subscription_id: subscription.id,
      amount: subscription.amount,
      currency: subscription.currency,
      status: subscription.status,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      name: name || 'anise-subscription'
    });
    res.json({
      subscription_id: subscription.id,
      status: subscription.status,
      amount: subscription.amount,
      currency: subscription.currency,
      interval_unit: subscription.interval_unit,
      interval: subscription.interval
    });
  } catch (err: any) {
    console.error('Error creating subscription:', err.message);
    res.status(500).json({ error: err.message });
  }
};

export const listSubscriptions = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    // List subscriptions from Firestore
    const subscriptionsSnapshot = await db.collection('users').doc(userId).collection('subscriptions').get();
    const subscriptions: any[] = [];
    subscriptionsSnapshot.forEach(doc => {
      subscriptions.push({ id: doc.id, ...doc.data() });
    });
    res.json(subscriptions);
  } catch (err: any) {
    console.error('Error fetching subscriptions:', err.message);
    res.status(500).json({ error: err.message });
  }
};

export const webhookHandler = async (req: Request, res: Response) => {
  try {
    const { events } = req.body;
    for (const event of events) {
      const { resource_type, action, links } = event;
      // Handle payment events
      if (resource_type === 'payments') {
        if (action === 'confirmed') {
          // Payment successful - update Firestore
          // TODO: Implement payment success logic
        } else if (action === 'failed') {
          // Payment failed - update Firestore
          // TODO: Implement payment failure logic
        }
      }
      // Handle subscription events
      if (resource_type === 'subscriptions') {
        if (action === 'created') {
          // Subscription created - update Firestore
          // TODO: Implement subscription created logic
        } else if (action === 'cancelled') {
          // Subscription cancelled - update Firestore
          // TODO: Implement subscription cancelled logic
        }
      }
    }
    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
}; 