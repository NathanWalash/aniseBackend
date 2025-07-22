# Anise Backend

A professional Node.js/Express + TypeScript backend for the Anise platform. Handles authentication (via Firebase), DAO management, user profiles, and GoCardless payment flows.

---

## Features

- **Authentication:** Signup, login, password reset, and profile management via Firebase Auth and Firestore.
- **Protected Routes:** Uses Firebase Admin SDK to verify tokens for secure endpoints.
- **DAO Management:** Create and manage DAOs with member management, proposals, claims, and treasury.
- **Firestore Caching:** All blockchain state is cached in Firestore for fast queries.
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
│   └── serviceAccountKey.json         # Firebase Admin SDK service account
├── src/
│   ├── app.ts                         # Express app setup
│   ├── server.ts                      # Server entry point
│   ├── firebaseAdmin.ts               # Firebase Admin initialization
│   ├── controllers/
│   │   ├── authController.ts          # Auth logic
│   │   ├── daoController.ts           # DAO management
│   │   ├── memberController.ts        # Member management
│   │   ├── proposalController.ts      # Proposal management
│   │   ├── claimController.ts         # Claim management
│   │   ├── treasuryController.ts      # Treasury management
│   │   ├── paymentController.ts       # Payment logic (GoCardless)
│   │   └── webhookController.ts       # GoCardless webhook handler
│   ├── middlewares/
│   │   └── verifyFirebaseToken.ts     # Auth middleware
│   ├── routes/                        # API route definitions
│   ├── utils/
│   │   ├── gocardlessClient.ts        # GoCardless SDK client
│   │   └── verifyTransaction.ts       # Blockchain tx verification
│   └── abis/                          # Smart contract ABIs
├── tests/
└── .env (not committed)               # Environment variables
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
   TOKEN_ADDRESS=your_token_contract_address
   ```

4. **Add Firebase service account**  
   - Download your service account JSON from Firebase Console.
   - Place it at `aniseBackend/config/serviceAccountKey.json`.

5. **Run the server (dev mode)**
   ```bash
   npm run dev
   ```

---

## Firestore Setup & Indexing

### Required Indexes

The backend uses collection group queries which require specific indexes. When you first run certain queries, you'll get errors with links to create the required indexes. The main required index is:

1. **Members Collection Group Index:**
   - Collection ID: `members`
   - Fields to index:
     - `walletAddress` (Ascending)
   - Query scope: Collection group

To create indexes:

1. **Automatic Method (Recommended):**
   - Run the backend and try to access an endpoint that needs the index
   - Look for an error message containing a direct link to create the index
   - Click the link and create the index in Firebase Console

2. **Manual Method:**
   - Go to Firebase Console > Firestore > Indexes
   - Click "Add Collection Group Index"
   - Fill in the fields as specified above

Note: Indexes take a few minutes to build. The backend includes commented code to help generate index creation links if needed.

---

## API Endpoints

### Auth (`/api/auth`)
- `POST   /login`           — Log in with email/password
- `POST   /signup`          — Create a new user
- `GET    /me`             — Get current user profile

### Users (`/api/users`)
- `POST   /wallet/connect`  — Link wallet to user profile
- `GET    /:userId/daos`    — List user's DAOs
- `GET    /:userId/notifications` — Get user notifications

### DAOs (`/api/daos`)
- `GET    /`               — List/search all DAOs
- `GET    /:daoAddress`    — Get DAO details
- `POST   /`              — Create new DAO

### Members (`/api/daos/:daoAddress/members`)
- `GET    /`               — List DAO members
- `GET    /join-requests`  — List join requests
- `POST   /join-requests`  — Request to join
- `POST   /join-requests/approve` — Approve join request
- `POST   /join-requests/reject`  — Reject join request

### Proposals (`/api/daos/:daoAddress/proposals`)
- `GET    /`               — List proposals
- `GET    /:proposalId`    — Get proposal details
- `POST   /`              — Create proposal
- `POST   /:proposalId/votes` — Vote on proposal

### Claims (`/api/daos/:daoAddress/claims`)
- `GET    /`               — List claims
- `GET    /:claimId`       — Get claim details
- `POST   /`              — Create claim
- `POST   /:claimId/votes` — Vote on claim

### Treasury (`/api/daos/:daoAddress/treasury`)
- `GET    /`               — Get treasury info
- `GET    /transactions`   — List transactions
- `POST   /deposit`        — Record deposit
- `POST   /withdraw`       — Record withdrawal

### Payments (`/api/payment`)
- `POST   /start-redirect-flow`    — Start GoCardless mandate setup
- `POST   /confirm-redirect-flow`  — Confirm mandate
- `POST   /create-payment`         — Create one-off payment
- `POST   /webhook`                — GoCardless webhook endpoint

---

## Implementation Status

1. ✅ Smart Contracts - Complete & Robust
2. ✅ DAO Creation Flow - Complete & Working
3. ✅ Firestore Data Model - Finalized
4. ✅ GET Endpoints - All implemented
5. ⚠️ POST/PUT Endpoints - Partially Complete
   - ✅ Authentication/User Management
   - ✅ DAO Creation
   - ⚠️ Member Management (in progress)
   - ⚠️ Voting/Claims (in progress)
   - 🚧 Treasury Management (not started)
6. 🚧 Payment Integration - In Progress
7. ⏳ Notifications - Not Started

---

## Connecting to the Frontend (ngrok Setup)

To allow the mobile app to connect to your local backend:

1. **Start your backend server** (default port 4001)
2. **Start ngrok:**
   ```bash
   ngrok http 4001
   ```
3. **Copy the HTTPS URL** (e.g., `https://xxxx-xxx-xxx-xxx.ngrok-free.app`)
4. **Update frontend's API base URL** in `aniseProject/src/utils/api.ts`

Note: Update the frontend's `API_BASE_URL` each time you restart ngrok.

---

## Troubleshooting

- **CORS errors?**  
  Check frontend's API_BASE_URL matches current ngrok URL
- **Token/auth errors?**  
  Verify Firebase service account and API key
- **Missing index errors?**  
  Look for the index creation link in the error message
- **Port conflicts?**  
  Change PORT in .env and restart both backend and ngrok

---

## License

MIT