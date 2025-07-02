import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import fs from 'fs';

let testIds: Record<string, string> = {};
try {
  testIds = JSON.parse(fs.readFileSync('tests/test-output.json', 'utf-8'));
} catch (e) {
  throw new Error('Run the payment API test first to generate tests/test-output.json with real GoCardless IDs.');
}

const PORT = process.env.PORT || '3001';
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}/api`;
const WEBHOOK_URL = `${API_BASE_URL}/payment/webhook`;

// NOTE: These tests simulate GoCardless webhook events by POSTing example payloads to the webhook endpoint.
// They do NOT test real GoCardless-to-backend delivery or signature verification.
// TODO: Add signature verification tests when implemented in backend.
// TODO: For true E2E, test with real GoCardless dashboard events.
// TODO: Add assertions for Firestore/database updates and business logic hooks.

describe('GoCardless Webhook API (Simulated)', () => {
  it('should process a payment confirmed and failed event', async () => {
    const eventPayload = {
      events: [
        {
          id: "EV123",
          created_at: "2014-08-03T12:00:00.000Z",
          action: "confirmed",
          resource_type: "payments",
          links: { payment: testIds.payment_id || testIds.subscription_id },
          details: {
            origin: "gocardless",
            cause: "payment_confirmed",
            description: "Payment was confirmed as collected"
          }
        },
        {
          id: "EV456",
          created_at: "2014-08-03T12:00:00.000Z",
          action: "failed",
          resource_type: "payments",
          links: { payment: testIds.payment_id || testIds.subscription_id },
          details: {
            origin: "bank",
            cause: "mandate_cancelled",
            description: "Customer cancelled the mandate at their bank branch.",
            scheme: "bacs",
            reason_code: "ARUDD-1"
          }
        }
      ],
      meta: { webhook_id: "WB123" }
    };
    const res = await axios.post(WEBHOOK_URL, eventPayload);
    expect([200, 204]).toContain(res.status);
    // TODO: Check Firestore or mock DB for correct update
  });

  it('should process a mandate cancelled and expired event', async () => {
    const eventPayload = {
      events: [
        {
          id: "EV123",
          created_at: "2014-08-04T12:00:00.000Z",
          action: "cancelled",
          resource_type: "mandates",
          links: { mandate: testIds.mandate_id },
          details: {
            origin: "bank",
            cause: "bank_account_disabled",
            description: "Your customer closed their bank account.",
            scheme: "bacs",
            reason_code: "ADDACS-B"
          }
        },
        {
          id: "EV456",
          created_at: "2014-08-04T12:00:00.000Z",
          action: "expired",
          resource_type: "mandates",
          links: { mandate: testIds.mandate_id },
          details: {
            origin: "gocardless",
            cause: "mandate_expired",
            description: "The mandate expired due to inactivity."
          }
        }
      ],
      meta: { webhook_id: "WB123" }
    };
    const res = await axios.post(WEBHOOK_URL, eventPayload);
    expect([200, 204]).toContain(res.status);
    // TODO: Check Firestore or mock DB for correct update
  });

  it('should process a subscription payment_created event', async () => {
    const eventPayload = {
      events: [
        {
          id: "EV123",
          created_at: "2014-08-04T12:00:00.000Z",
          action: "payment_created",
          resource_type: "subscriptions",
          links: { subscription: testIds.subscription_id, payment: testIds.payment_id || testIds.subscription_id }
        }
      ],
      meta: { webhook_id: "WB123" }
    };
    const res = await axios.post(WEBHOOK_URL, eventPayload);
    expect([200, 204]).toContain(res.status);
    // TODO: Check Firestore or mock DB for correct update
  });

  // TODO: Add more tests for other event types and edge cases
}); 