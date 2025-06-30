# Anise Backend

A professional Node.js/Express + TypeScript backend for the Anise mobile app. Handles authentication (via Firebase), user profiles, and (future) payment flows.

---

## Features

- **Authentication**: Signup, login, password reset, and profile management via Firebase Auth and Firestore.
- **Protected Routes**: Uses Firebase Admin SDK to verify tokens for secure endpoints.
- **Payment API (Planned)**: Endpoints for GoCardless integration are scaffolded but not yet implemented.
- **TypeScript**: Fully typed, strict config.
- **Environment-based config**: Uses `.env` and a Firebase service account key.

---

## Security & Authentication

- **JWT-based Auth:**
  - When a user logs in or signs up, the backend issues a Firebase ID token (JWT) and a refresh token.
  - The frontend stores these tokens securely (e.g., in AsyncStorage on mobile).
- **Protected Endpoints:**
  - For any protected API (e.g., `/api/auth/me`), the frontend must send the ID token in the `Authorization: Bearer <token>` header.
  - The backend uses the Firebase Admin SDK to verify the token's signature and validity on every request.
  - If the token is missing, expired, or invalid, the backend returns a 401 Unauthorized error.
- **Why is this secure?**
  - Tokens are signed by Google and can't be forged by clients.
  - Only the backend (with the Firebase Admin SDK and service account) can fully verify and decode the token.
  - No sensitive Firebase credentials are ever exposed to the frontend or users.
  - All sensitive user data and actions are protected by token verification middleware.
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
│   │   └── paymentController.ts # Payment logic (placeholders)
│   ├── middlewares/
│   │   └── verifyFirebaseToken.ts # Auth middleware
│   ├── routes/
│   │   ├── authRoutes.ts        # /api/auth/*
│   │   └── paymentRoutes.ts     # /api/payment/*
│   └── ...
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
   PORT=3001
   FIREBASE_API_KEY=your_firebase_web_api_key
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_STORAGE_BUCKET=your_project.appspot.com
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
2. **Start ngrok** to tunnel your backend port (default is 3001):
   ```bash
   ngrok http 3001
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
- `POST   /start-redirect-flow`    — *Not implemented*
- `POST   /confirm-redirect-flow`  — *Not implemented*
- `POST   /create-payment`         — *Not implemented*
- `POST   /create-subscription`    — *Not implemented*
- `GET    /subscriptions`          — *Not implemented*
- `POST   /webhook`                — *Not implemented*

---

## Troubleshooting
- **CORS errors?**  
  Make sure your frontend is using the correct backend URL (the current ngrok URL).
- **Token/auth errors?**  
  Ensure your Firebase service account and API key are correct and match your Firebase project.
- **ngrok:**  
  If using ngrok, update the frontend's `API_BASE_URL` each time you restart ngrok.
- **Port conflicts?**  
  Make sure nothing else is running on port 3001, or change the `PORT` in your `.env` and restart both backend and ngrok.

---

## Development Notes

- **Frontend connection:**  
  The mobile app must set its `API_BASE_URL` to your backend's public URL (use ngrok for local dev).
- **Firebase:**  
  All user auth is handled via Firebase Admin SDK and REST API.
- **Payments:**  
  GoCardless endpoints are placeholders—implement as needed.

---

## License

MIT