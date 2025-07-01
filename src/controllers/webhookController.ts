import { Request, Response } from 'express';
import client from '../utils/gocardlessClient';
import admin from '../firebaseAdmin';

const db = admin.firestore();

// Helper to remove Firestore reserved fields
function removeReservedFields(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([key]) => !key.startsWith('__'))
      .map(([key, value]) => [key, removeReservedFields(value)])
  );
}

// TODO: Implement signature verification for production (see GoCardless docs)
// TODO: Store webhook body for audit/durability (e.g., in Firestore or a queue)
// TODO: Implement deduplication logic (webhooks may be delivered multiple times)

export const handleGoCardlessWebhook = async (req: Request, res: Response) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) {
      // Invalid payload, ignore
      res.status(204).end();
      return;
    }
    for (const event of events) {
      const { resource_type, action, links, details } = event;
      // TODO: Optionally, check details.cause for business logic
      // Fetch the latest resource state from GoCardless for validation
      if (resource_type === 'payments') {
        const paymentId = links && links.payment;
        if (paymentId) {
          const payment = await client.payments.find(paymentId);
          const sanitized = removeReservedFields(payment);
          await db.collection('payments').doc(paymentId).set(sanitized, { merge: true });
          // TODO: Add business logic here (e.g., notify user, update access)
        }
      } else if (resource_type === 'subscriptions') {
        const subscriptionId = links && links.subscription;
        if (subscriptionId) {
          const subscription = await client.subscriptions.find(subscriptionId);
          const sanitized = removeReservedFields(subscription);
          await db.collection('subscriptions').doc(subscriptionId).set(sanitized, { merge: true });
          // TODO: Add business logic here (e.g., update user entitlements)
        }
      } else if (resource_type === 'mandates') {
        const mandateId = links && links.mandate;
        if (mandateId) {
          const mandate = await client.mandates.find(mandateId);
          const sanitized = removeReservedFields(mandate);
          await db.collection('mandates').doc(mandateId).set(sanitized, { merge: true });
          // TODO: Add business logic here (e.g., handle mandate failure/cancellation)
        }
      } else {
        // Unknown event/resource type, ignore for now
        // TODO: Log or handle new event types as needed
        continue;
      }
    }
    // Respond quickly to GoCardless (do heavy work async if needed)
    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    // For production, consider returning 204 for unknown/invalid events
    res.status(500).json({ error: err.message });
  }
}; 