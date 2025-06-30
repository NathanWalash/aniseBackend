# GoCardless Backend - Clean & Simple

A minimal Node.js/Express backend for GoCardless Direct Debit integration.

## Files
- `index.js` - Complete backend with all endpoints and test interface
- `package.json` - Dependencies
- `README.md` - This file

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set environment variables:**
   Create a `.env` file:
   ```
   GOCARDLESS_ACCESS_TOKEN=your_sandbox_access_token
   ```

3. **Run the server:**
   ```bash
   node index.js
   ```

## Test Interface

Open `http://localhost:3001` for a complete test interface with:
- Start redirect flows
- Complete GoCardless forms
- Confirm mandates
- Create payments/subscriptions
- View all subscriptions

## API Endpoints

- `POST /api/start-redirect-flow` - Start payment setup
- `POST /api/confirm-redirect-flow` - Confirm mandate
- `POST /api/create-payment` - Create one-time payment
- `POST /api/create-subscription` - Create subscription
- `POST /api/cancel-subscription` - Cancel subscription
- `GET /api/subscriptions` - List subscriptions
- `POST /api/webhook` - Handle GoCardless events

## Integration

This backend works with:
- React Native app (PaymentScreen, SubscriptionsScreen)
- Firebase (user data, payment tracking)
- GoCardless webhooks (real-time updates)

## Notes

- Uses GoCardless sandbox environment
- Single file backend (`index.js`)
- Ready for production deployment