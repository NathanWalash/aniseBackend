// tests/paymentApi.test.ts
// Usage: Fill in your test user's email and password in getIdToken.js, then run with `ts-node tests/paymentApi.test.ts`

import axios from 'axios';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const PORT = process.env.PORT || '3001';
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}/api`;

// Helper to get the ID token by running getIdToken.js
function getIdTokenSync(): string {
  try {
    const output = execSync('node tests/getIdToken.js', { encoding: 'utf-8' });
    const match = output.match(/ID_TOKEN:\s*(.+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    throw new Error('ID token not found in getIdToken.js output');
  } catch (err: any) {
    console.error('Failed to get ID token:', err.message);
    process.exit(1);
  }
}

const ID_TOKEN = getIdTokenSync();
console.log('Using ID_TOKEN:', ID_TOKEN ? ID_TOKEN.substring(0, 40) + '...' : 'NONE');

// Test user data
const testUser = {
  name: 'Test User',
  email: 'walash@email.com',
};

// Store data between steps
let session_token = '';
let redirect_flow_id = '';
let mandate_id = '';
let customer_id = '';
let subscription_id = '';
let payment_id = '';

async function startRedirectFlow() {
  console.log('--- Start Redirect Flow ---');
  const url = `${API_BASE_URL}/start-redirect-flow`;
  const payload = { name: testUser.name, email: testUser.email };
  const headers = { Authorization: `Bearer ${ID_TOKEN}` };
  console.log('POST', url);
  console.log('Payload:', payload);
  console.log('Headers:', headers);
  const res = await axios.post(url, payload, { headers });
  const data: any = res.data;
  console.log('Response:', data);
  session_token = data.session_token;
  redirect_flow_id = data.redirect_flow_id;
}

async function confirmRedirectFlow() {
  console.log('--- Confirm Redirect Flow ---');
  const url = `${API_BASE_URL}/confirm-redirect-flow`;
  const payload = { redirect_flow_id, session_token };
  const headers = { Authorization: `Bearer ${ID_TOKEN}` };
  console.log('POST', url);
  console.log('Payload:', payload);
  console.log('Headers:', headers);
  const res = await axios.post(url, payload, { headers });
  const data: any = res.data;
  console.log('Response:', data);
  mandate_id = data.mandate_id;
  customer_id = data.customer_id;
}

async function createPayment() {
  console.log('--- Create Payment ---');
  const url = `${API_BASE_URL}/create-payment`;
  const payload = { amount: 1000, currency: 'GBP', mandate_id };
  const headers = { Authorization: `Bearer ${ID_TOKEN}` };
  console.log('POST', url);
  console.log('Payload:', payload);
  console.log('Headers:', headers);
  const res = await axios.post(url, payload, { headers });
  const data: any = res.data;
  console.log('Response:', data);
  payment_id = data.payment_id;
}

async function createSubscription() {
  console.log('--- Create Subscription ---');
  const url = `${API_BASE_URL}/create-subscription`;
  const payload = { amount: 500, currency: 'GBP', mandate_id, interval_unit: 'monthly', interval: 1, name: 'Test Subscription' };
  const headers = { Authorization: `Bearer ${ID_TOKEN}` };
  console.log('POST', url);
  console.log('Payload:', payload);
  console.log('Headers:', headers);
  const res = await axios.post(url, payload, { headers });
  const data: any = res.data;
  console.log('Response:', data);
  subscription_id = data.subscription_id;
}

async function listSubscriptions() {
  console.log('--- List Subscriptions ---');
  const url = `${API_BASE_URL}/subscriptions`;
  const headers = { Authorization: `Bearer ${ID_TOKEN}` };
  console.log('GET', url);
  console.log('Headers:', headers);
  const res = await axios.get(url, { headers });
  const data: any = res.data;
  console.log('Response:', data);
}

async function runAll() {
  try {
    await startRedirectFlow();
    // At this point, you must complete the GoCardless form in the browser using the redirect_url from the previous step.
    console.log('Please complete the GoCardless form at the above redirect_url, then press Enter to continue...');
    await new Promise((resolve) => process.stdin.once('data', resolve));
    await confirmRedirectFlow();
    await createPayment();
    await createSubscription();
    await listSubscriptions();
    // Save IDs for use in webhook tests
    fs.writeFileSync('tests/test-output.json', JSON.stringify({
      mandate_id,
      customer_id,
      subscription_id,
      payment_id
    }, null, 2));
    console.log('Saved test IDs to tests/test-output.json');
    console.log('All payment API tests completed.');
  } catch (err: any) {
    console.error('Test failed:');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Headers:', err.response.headers);
      console.error('Data:', err.response.data);
    } else {
      console.error(err);
    }
  }
}

runAll(); 