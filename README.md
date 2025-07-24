# Anise Backend

A professional Node.js/Express + TypeScript backend for the Anise platform. Handles authentication (via Firebase), DAO management, user profiles, and GoCardless payment flows.

## Firestore Data Structure

### Users Collection (`/users/{userId}`)
```typescript
{
  firstName: string,
  lastName: string,
  email: string,
  dateOfBirth: string,
  createdAt: number,
  wallet: {
    address: string,
    linkedAt: timestamp
  }
}
```

### DAOs Collection (`/daos/{daoAddress}`)
```typescript
{
  daoAddress: string,
  creator: string,
  createdAt: timestamp,
  blockNumber: number,
  txHash: string,
  metadata: {
    name: string,
    description: string,
    templateId: string,
    mandate: string,
    intendedAudience: string,
    isPublic: boolean
  },
  modules: {
    ClaimVotingModule: {
      config: { approvalThreshold: number }
    },
    ProposalVotingModule: {
      config: { approvalThreshold: number }
    },
    MemberModule: {
      config: {}
    },
    TreasuryModule: {
      address: string,
      config: {}
    }
  }
}
```

### Members Subcollection (`/daos/{daoAddress}/members/{walletAddress}`)
```typescript
{
  role: "Admin" | "Member",
  joinedAt: timestamp,
  uid: string
}
```

### Join Requests Subcollection (`/daos/{daoAddress}/joinRequests/{walletAddress}`)
```typescript
{
  uid: string,
  requestedAt: timestamp,
  status: "pending"
}
```

### Proposals Subcollection (`/daos/{daoAddress}/proposals/{proposalId}`)
```typescript
{
  proposalId: number,
  proposer: string,
  title: string,
  description: string,
  status: "pending" | "approved" | "rejected",
  createdAt: timestamp,
  votes: Record<string, boolean>,
  voters: string[]
}
```

### Claims Subcollection (`/daos/{daoAddress}/claims/{claimId}`)
```typescript
{
  claimId: number,
  claimant: string,
  title: string,
  description: string,
  amount: string,
  status: "pending" | "approved" | "rejected" | "paid",
  createdAt: timestamp,
  votes: Record<string, boolean>,
  voters: string[]
}
```

### User Notifications (`/users/{uid}/notifications/{notificationId}`)
```typescript
{
  message: string,
  type: string,
  daoAddress: string,
  isRead: boolean,
  createdAt: timestamp
}
```

## Implementation Status

### Completed (✅)
1. **Authentication & User Management**
   - Firebase Auth integration
   - User profile management
   - Wallet linking

2. **DAO Management**
   - DAO creation with on-chain verification
   - DAO listing and details
   - Member management structure

3. **GET Endpoints**
   - User profile and wallet info
   - DAO listings and details
   - Member listings
   - Basic proposal/claim viewing

### In Progress (⚠️)
1. **Member Management**
   - Join request handling
   - Role management
   - Member removal

2. **Voting System**
   - Proposal creation and voting
   - Claim submission and voting
   - Vote verification and counting

### Not Started (🚧)
1. **Treasury Management**
   - Deposit tracking
   - Withdrawal verification
   - Balance updates

2. **Notifications**
   - Event tracking
   - Notification creation
   - Read/unread status

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

## Important Implementation Notes

1. **Member Document IDs**
   - Member documents use wallet addresses as their document IDs
   - Example: `/daos/{daoAddress}/members/0x58EeBe87F92798d1F3D82ae1ab642aC79dD096BE`

2. **Wallet Addresses**
   - Stored in user documents under `wallet.address`
   - Used as document IDs in members collections
   - Case-sensitive, stored as-is from blockchain

3. **Timestamps**
   - All timestamps are Firestore timestamps
   - `createdAt` fields use server timestamps
   - `joinedAt` and other time fields are also timestamps

4. **Role Management**
   - Roles are stored as strings: "Admin" or "Member"
   - Default role is "Member" if not specified

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