# Anise Backend

A professional Node.js/Express + TypeScript backend for the Anise mobile app. Handles authentication (via Firebase), user profiles, and GoCardless payment flows.

---

## Features

- **Authentication:** Signup, login, password reset, and profile management via Firebase Auth and Firestore.
- **Protected Routes:** Uses Firebase Admin SDK to verify tokens for secure endpoints.
- **GoCardless Payment API:** Endpoints for mandate setup, payments, subscriptions, and webhooks.
- **TypeScript:** Fully typed, strict config.
- **Environment-based config:** Uses `.env` and a Firebase service account key.

---

## Security & Authentication

- **JWT-based Auth:**  
  - When a user logs in or signs up, the backend issues a Firebase ID token (JWT) and a refresh token.
  - The frontend stores these tokens securely (e.g., in AsyncStorage on mobile).
- **Protected Endpoints:**  
  - For any protected API (e.g., `/api/auth/me`), the frontend must send the ID token in the `Authorization: Bearer <token>` header.
  - The backend uses the Firebase Admin SDK to verify the token's signature and validity on every request.
  - If the token is missing, expired, or invalid, the backend returns a 401 Unauthorized error.
- **Token Refresh:**  
  - When the ID token expires, the frontend uses the refresh token (via Firebase REST API) to get a new ID token, without needing the user to log in again.

---

## Project Structure

```
aniseBackend/
├── config/
│   └── serviceAccountKey.json   # Firebase Admin SDK service account
├── src/
│   ├── app.ts                   # Express app setup
│   ├── server.ts                # Server entry point
│   ├── firebaseAdmin.ts         # Firebase Admin initialization
│   ├── controllers/
│   │   ├── authController.ts    # Auth logic
│   │   └── paymentController.ts # Payment logic (GoCardless)
│   ├── middlewares/
│   │   └── verifyFirebaseToken.ts # Auth middleware
│   ├── routes/
│   │   ├── authRoutes.ts        # /api/auth/*
│   │   └── paymentRoutes.ts     # /api/payment/*
│   ├── utils/
│   │   └── gocardlessClient.ts  # GoCardless SDK client
│   └── ...
├── tests/
│   ├── getIdToken.js            # Utility to get Firebase ID token for tests
│   └── paymentApi.test.ts       # Automated payment API tests
├── package.json
├── tsconfig.json
└── .env (not committed)
```

---

## Setup & Installation

1. **Clone the repo**
   ```bash
   git clone <YOUR_REPO_URL>
   cd anise/aniseBackend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Add environment variables**  
   Create a `.env` file in `aniseBackend/`:
   ```
   PORT=4001
   FIREBASE_API_KEY=your_firebase_web_api_key
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   GOCARDLESS_ACCESS_TOKEN=your_gocardless_access_token
   GOCARDLESS_ENVIRONMENT=sandbox
   GOCARDLESS_SUCCESS_URL=https://your-ngrok-url.ngrok-free.app/success
   API_BASE_URL=https://your-ngrok-url.ngrok-free.app/api
   ```

4. **Add Firebase service account**  
   - Download your service account JSON from Firebase Console.
   - Place it at `aniseBackend/config/serviceAccountKey.json`.

5. **Run the server (dev mode)**
   ```bash
   npm run dev
   ```
   Or build and run:
   ```bash
   npm run build
   npm start
   ```

---

## Connecting to the Frontend (ngrok Setup)

To allow the mobile app or frontend to connect to your local backend, you must expose it to the internet using [ngrok](https://ngrok.com/).

### **How to set up ngrok:**
1. **Start your backend server locally** (see above).
2. **Start ngrok** to tunnel your backend port (default is 4001):
   ```bash
   ngrok http 4001
   ```
3. **Copy the HTTPS URL** that ngrok gives you (e.g., `https://xxxx-xxx-xxx-xxx.ngrok-free.app`).
4. **Update the frontend API base URL**:
   - Open `aniseProject/src/utils/api.ts` in the frontend project.
   - Change the value of `API_BASE_URL` to your ngrok URL:
     ```js
     export const API_BASE_URL = "https://xxxx-xxx-xxx-xxx.ngrok-free.app";
     ```
5. **Save and restart the Expo app** if needed.

**Note:** If you restart ngrok, the URL will change. You must update the frontend's `API_BASE_URL` each time.

---

## API Endpoints

### **Auth (`/api/auth`)**
- `POST   /login`           — Log in with email/password
- `POST   /signup`          — Create a new user
- `POST   /forgot-password` — Send password reset email
- `GET    /me`              — Get current user profile (requires Bearer token)
- `PUT    /me`              — Update user profile (requires Bearer token)

### **Payments (`/api/payment`)**
- `POST   /start-redirect-flow`    — Start GoCardless mandate setup (redirect flow)
- `POST   /confirm-redirect-flow`  — Confirm GoCardless mandate after user returns
- `POST   /create-payment`         — Create a one-off payment using a mandate
- `POST   /create-subscription`    — Create a recurring subscription using a mandate
- `GET    /subscriptions`          — List user subscriptions (from Firestore)
- `POST   /webhook`                — GoCardless webhook endpoint (handles payment/subscription events)

---

## GoCardless Setup & Usage

- **Get your GoCardless sandbox access token** from the GoCardless dashboard.
- Set `GOCARDLESS_ENVIRONMENT` to `sandbox` for development, or `live` for production.
- Set `GOCARDLESS_SUCCESS_URL` to the URL your users should be redirected to after mandate setup (e.g., your frontend or a test page).
- All payment/subscription data is stored in Firestore under each user.
- Webhook endpoint is `/api/payment/webhook` (configure this in your GoCardless dashboard).
- **API Flow:**  
  1. Start redirect flow to get a GoCardless form URL.
  2. User completes the form and is redirected to your success URL.
  3. Confirm the redirect flow to obtain a mandate and customer ID.
  4. Use the mandate ID to create payments or subscriptions.
  5. List subscriptions or handle webhooks for real-time updates.

---

## Testing

- Use `tests/getIdToken.js` to obtain a Firebase ID token for a test user.
- Use `tests/paymentApi.test.ts` to run automated tests for all payment endpoints.
- Update your `.env` and test user credentials as needed.

---

## Troubleshooting

- **CORS errors?**  
  Make sure your frontend is using the correct backend URL (the current ngrok URL).
- **Token/auth errors?**  
  Ensure your Firebase service account and API key are correct and match your Firebase project.
- **ngrok:**  
  If using ngrok, update the frontend's `API_BASE_URL` each time you restart ngrok.
- **Port conflicts?**  
  Make sure nothing else is running on your backend port, or change the `PORT` in your `.env` and restart both backend and ngrok.

---

## License

MIT