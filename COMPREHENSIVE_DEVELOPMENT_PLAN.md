# Anise DAO Platform - Comprehensive Development Plan

## 🎯 **Overview**
This document provides a complete roadmap for developing the Anise DAO platform, integrating smart contracts with a dual-mode user experience. The platform supports both simple mode (relayer-based) and advanced mode (user-controlled wallets) for maximum adoption and flexibility.

---

## 🏗️ **System Architecture**

### **Three-Tier Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Blockchain    │
│  (React Native) │◄──►│  (Node.js/TS)   │◄──►│  (Smart Contracts) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Firestore     │
                       │   (Database)    │
                       └─────────────────┘
```

### **Dual-Mode User Experience**
- **Simple Mode**: Auto-generated wallets + relayer (backend pays gas)
- **Advanced Mode**: External wallet connection (users pay gas)

---

## 📋 **Current Backend Status**

### **Existing Infrastructure**
- ✅ **Authentication**: Firebase Auth with JWT tokens
- ✅ **Database**: Firebase Firestore for user data and caching
- ✅ **Payment Processing**: GoCardless integration for direct debit
- ✅ **API Structure**: RESTful endpoints with TypeScript
- ✅ **Testing**: Jest with comprehensive test coverage

### **Current API Endpoints**
```
/api/auth/
├── POST /login
├── POST /signup  
├── POST /forgot-password
├── GET /me (protected)
└── PUT /me (protected)

/api/payment/
├── POST /start-redirect-flow
├── POST /confirm-redirect-flow
├── POST /create-payment
├── POST /create-subscription
├── GET /subscriptions
└── POST /webhook
```

---

## 🏗️ **Smart Contract Integration**

### **Core Contracts**
```javascript
const CONTRACTS = {
  DAO_FACTORY: "0x...",           // DaoFactory.sol
  TEMPLATE_CATALOG: "0x...",      // TemplateCatalog.sol
  TOKEN: "0x...",                 // Token.sol (aniseGBP)
  RELAYER: "0x...",               // AniseRelayer.sol (NEW)
};
```

### **Key Contract Functions**
```solidity
// DaoFactory.sol
function createDAO(string name, string description, address[] modules, bytes[] moduleData, address token) 
    external returns (address daoAddress)

// DaoKernel.sol  
function createProposal(string title, string description, uint256 amount, uint256 deadline) 
    external returns (uint256 proposalId)
function voteOnProposal(uint256 proposalId, bool vote) external
function executeProposal(uint256 proposalId) external

// AniseRelayer.sol (NEW)
function executeTransaction(address target, bytes calldata data, bytes32 nonce) 
    external onlyAuthorized
```

---

## 🔄 **Dual-Mode User Experience**

### **Simple Mode (Relayer-Based)**
**Target Users**: Mainstream users, crypto beginners
**Experience**: 
- ✅ Auto-generated wallet (hidden from user)
- ✅ No gas fees (backend pays via relayer)
- ✅ Instant transactions
- ✅ No wallet setup required
- ❌ Less decentralized (relayer controls transactions)

### **Advanced Mode (WalletConnect)**
**Target Users**: Crypto-native users, power users
**Experience**:
- ✅ External wallet connection (MetaMask, Trust, etc.)
- ✅ True decentralization
- ✅ User pays gas fees
- ✅ Full control over transactions
- ❌ More complex setup (wallet connection required)

---

## 🗄️ **Enhanced Firestore Schema**

### **Users Collection**
```javascript
users/{userId}/
├── profile: { 
    firstName: string,
    lastName: string, 
    email: string,
    dateOfBirth: Timestamp
  }
├── wallet: {                    // Auto-generated wallet (ALWAYS present)
    address: string,
    encryptedKey: string,        // Encrypted private key
    createdAt: Timestamp
  }
├── connectedWallet: {           // External wallet (ONLY for advanced mode)
    address: string,
    type: "metamask" | "trust" | "rainbow",
    connectedAt: Timestamp
  }
├── preferences: {
    defaultMode: "simple" | "advanced"
  }
└── daos: {                      // User's DAO memberships
    "{daoAddress}": { 
      role: "member" | "admin",
      joinedAt: Timestamp,
      mode: "simple" | "advanced"  // Which mode for THIS DAO
    }
  }
```

### **DAOs Collection**
```javascript
daos/{daoAddress}/
├── metadata: {
    name: string,
    description: string,
    creator: string,             // Firebase user ID
    contractAddress: string,
    createdAt: Timestamp,
    mode: "simple" | "advanced"  // DAO-level mode (chosen by creator)
  }
├── members: {
    "{walletAddress}": {         // Wallet address (auto-generated OR external)
      userId: string,            // Firebase user ID
      votingPower: number,
      joinedAt: Timestamp,
      role: "member" | "admin",
      walletType: "auto-generated" | "external"
    }
  }
├── proposals: {
    "{proposalId}": {
      title: string,
      description: string,
      amount: string,
      deadline: Timestamp,
      createdBy: string,         // Wallet address
      createdByUserId: string,   // Firebase user ID
      status: "active" | "executed" | "failed",
      votes: {
        "{walletAddress}": boolean
      },
      yesVotes: number,
      noVotes: number
    }
  }
├── claims: {
    "{claimId}": {
      amount: string,
      description: string,
      submitter: string,         // Wallet address
      submitterUserId: string,   // Firebase user ID
      status: "pending" | "approved" | "rejected",
      votes: {
        "{walletAddress}": boolean
      }
    }
  }
└── treasury: {
    balance: string,
    transactions: Array<{
      type: "deposit" | "withdrawal",
      amount: string,
      from: string,
      to: string,
      timestamp: Timestamp
    }>
  }
```

### **Relayer Collection**
```javascript
relayer/
├── transactions: {
    "{hash}": {
      userId: string,
      target: string,
      data: string,
      gasUsed: number,
      status: "pending" | "confirmed" | "failed",
      timestamp: Timestamp,
      nonce: string
    }
  }
├── gas_tracking: {
    dailyUsage: number,
    dailyLimit: number,
    lastReset: Timestamp
  }
└── queue: {
    "{nonce}": {
      pending: boolean,
      retries: number,
      userId: string
    }
  }
```

---

## 🚀 **API Endpoints (Enhanced)**

### **DAO Management**

#### **`POST /api/daos` - Create DAO**
```javascript
// Request
{
  "name": "My DAO",
  "description": "Description",
  "mode": "simple" | "advanced"  // DAO creator chooses mode
}

// Response
{
  "success": true,
  "data": {
    "daoAddress": "0x...",
    "txHash": "0x...",
    "status": "pending",
    "mode": "simple"
  }
}
```

#### **`GET /api/daos` - Get all DAOs (paginated)**
```javascript
// Parameters: page, limit, mode (filter by DAO mode)
// Response: { daos: [...], total, page, hasMore }
```

#### **`GET /api/daos/:daoAddress` - Get specific DAO**
```javascript
// Response includes mode and member wallet types
{
  "metadata": { ... },
  "mode": "simple",
  "memberCount": 10,
  "simpleModeMembers": 7,
  "advancedModeMembers": 3
}
```

### **Wallet Management**

#### **`GET /api/users/wallet` - Get user's wallet info**
```javascript
// Response
{
  "autoGeneratedWallet": {
    "address": "0x...",
    "createdAt": Timestamp
  },
  "connectedWallet": {
    "address": "0x...",
    "type": "metamask",
    "connectedAt": Timestamp
  },
  "preferences": {
    "defaultMode": "simple"
  }
}
```

#### **`POST /api/users/wallet/connect` - Connect external wallet**
```javascript
// For advanced mode users
{
  "walletType": "metamask",
  "address": "0x...",
  "signature": "0x..."  // Proof of ownership
}
```

### **Proposal Management**

#### **`POST /api/daos/:daoAddress/proposals` - Create proposal**
```javascript
// Backend automatically detects DAO mode and handles accordingly
// Simple mode: Uses relayer with auto-generated wallet
// Advanced mode: Requires user to sign with external wallet
```

#### **`POST /api/daos/:daoAddress/proposals/:proposalId/vote` - Vote on proposal**
```javascript
// Same logic - mode determines transaction method
```

### **Treasury Integration**

#### **`POST /api/daos/:daoAddress/treasury/deposit` - Deposit funds**
```javascript
// Integrates with GoCardless webhooks
// GoCardless payment → Mint tokens → DAO treasury
```

---

## 🔧 **Implementation Strategy**

### **Phase 1: Foundation (Weeks 1-2)**
**Goal**: Establish blockchain integration and wallet management

#### **1.1 Add Dependencies**
```bash
npm install ethers@5.7.2 web3 @walletconnect/client
npm install --save-dev @types/ethers
```

#### **1.2 Create Blockchain Service Layer**
```typescript
// src/services/blockchainService.ts
export class BlockchainService {
  private provider: ethers.providers.JsonRpcProvider;
  private relayerWallet: ethers.Wallet;
  
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(process.env.HARDHAT_RPC_URL);
    this.relayerWallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, this.provider);
  }
  
  async createDAO(name: string, description: string, modules: string[], moduleData: string[], token: string): Promise<string> {
    const daoFactory = new ethers.Contract(DAO_FACTORY_ADDRESS, DAO_FACTORY_ABI, this.relayerWallet);
    const tx = await daoFactory.createDAO(name, description, modules, moduleData, token);
    const receipt = await tx.wait();
    
    const event = receipt.events?.find(e => e.event === 'DAOCreated');
    return event?.args?.daoAddress;
  }
}
```

#### **1.3 Implement Relayer Service**
```typescript
// src/services/relayerService.ts
export class RelayerService {
  async executeTransaction(userId: string, target: string, data: string, nonce: string): Promise<string> {
    // Validate user permissions
    // Check gas limits
    // Execute transaction using user's auto-generated wallet
    // Store transaction record
    // Return transaction hash
  }
  
  async estimateGas(target: string, data: string): Promise<number> {
    // Estimate gas cost for transaction
  }
}
```

#### **1.4 Implement Wallet Service**
```typescript
// src/services/walletService.ts
export class WalletService {
  async createUserWallet(userId: string): Promise<string> {
    const wallet = ethers.Wallet.createRandom();
    const encryptedKey = await this.encryptPrivateKey(wallet.privateKey);
    
    await db.collection('users').doc(userId).update({
      wallet: {
        address: wallet.address,
        encryptedKey: encryptedKey,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }
    });
    
    return wallet.address;
  }
  
  async getUserWallet(userId: string): Promise<ethers.Wallet> {
    const userDoc = await db.collection('users').doc(userId).get();
    const walletData = userDoc.data()?.wallet;
    
    if (!walletData?.encryptedKey) {
      throw new Error('User wallet not found');
    }
    
    const privateKey = await this.decryptPrivateKey(walletData.encryptedKey);
    return new ethers.Wallet(privateKey);
  }
}
```

#### **1.5 Add Environment Variables**
```env
# Blockchain Configuration
HARDHAT_RPC_URL=http://localhost:8545
RELAYER_PRIVATE_KEY=0x...
DAO_FACTORY_ADDRESS=0x...
TOKEN_ADDRESS=0x...
RELAYER_ADDRESS=0x...

# Gas Management
MAX_GAS_PER_TRANSACTION=300000
GAS_LIMIT_DAILY=1000000
USER_DAILY_GAS_LIMIT=50000

# Wallet Encryption
WALLET_ENCRYPTION_KEY=your_encryption_key_here
```

### **Phase 2: DAO Management APIs (Weeks 3-4)**
**Goal**: Implement core DAO functionality with dual-mode support

#### **2.1 Enhanced DAO Controller**
```typescript
// src/controllers/daoController.ts
export const createDAO = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, mode = 'simple' } = req.body;
    const userId = (req as any).user.uid;
    
    // Get user's wallet
    const userWallet = await walletService.getUserWallet(userId);
    
    let daoAddress: string;
    
    if (mode === 'simple') {
      // Use relayer with auto-generated wallet
      daoAddress = await relayerService.executeTransaction(
        userId,
        DAO_FACTORY_ADDRESS,
        blockchainService.encodeCreateDAO(name, description, modules, token),
        generateNonce()
      );
    } else {
      // Check if user has connected external wallet
      const connectedWallet = await getConnectedExternalWallet(userId);
      if (!connectedWallet) {
        res.status(400).json({ error: 'Advanced mode requires connecting external wallet' });
        return;
      }
      
      // Use external wallet directly
      daoAddress = await blockchainService.createDAO(
        name, description, modules, token, connectedWallet
      );
    }
    
    // Store in Firestore
    await db.collection('daos').doc(daoAddress).set({
      metadata: {
        name, description, creator: userId, contractAddress: daoAddress,
        createdAt: admin.firestore.FieldValue.serverTimestamp(), mode
      },
      members: {
        [userWallet.address]: {
          userId: userId,
          votingPower: 1000,
          role: 'admin',
          walletType: mode === 'simple' ? 'auto-generated' : 'external'
        }
      },
      proposals: {},
      claims: {},
      treasury: { balance: '0', transactions: [] }
    });
    
    res.status(201).json({ daoAddress, mode });
    
  } catch (err: any) {
    console.error('Error creating DAO:', err);
    res.status(500).json({ error: err.message });
  }
};
```

### **Phase 3: Proposal & Voting System (Weeks 5-6)**
**Goal**: Implement proposal creation, voting, and execution with dual-mode support

### **Phase 4: Claim Management (Weeks 7-8)**
**Goal**: Implement claim submission and voting with dual-mode support

### **Phase 5: Treasury Integration (Weeks 9-10)**
**Goal**: Connect GoCardless payments to DAO treasury

#### **5.1 Enhanced Webhook Handler**
```typescript
// src/controllers/webhookController.ts
export const handleGoCardlessWebhook = async (req: Request, res: Response) => {
  try {
    const { events } = req.body;
    
    for (const event of events) {
      if (event.resource_type === 'payments' && event.action === 'confirmed') {
        const paymentId = event.links.payment;
        const payment = await client.payments.find(paymentId);
        
        // Find associated DAO and user
        const daoAddress = await findDAOForPayment(paymentId);
        if (daoAddress) {
          // Mint tokens to DAO treasury
          await blockchainService.mintTokens(
            TOKEN_ADDRESS,
            daoAddress,
            payment.amount
          );
          
          // Update DAO treasury balance
          await updateDAOTreasury(daoAddress, payment.amount, 'deposit');
        }
      }
    }
    
    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
};
```

### **Phase 6: Advanced Mode (Weeks 11-12)**
**Goal**: Add WalletConnect integration for advanced users

#### **6.1 WalletConnect Service**
```typescript
// src/services/walletConnectService.ts
export class WalletConnectService {
  private connector: WalletConnect;
  
  constructor() {
    this.connector = new WalletConnect({
      bridge: 'https://bridge.walletconnect.org',
      clientMeta: {
        name: 'Anise',
        description: 'DAO Platform',
        url: 'https://anise.org',
        icons: ['https://anise.org/icon.png']
      }
    });
  }
  
  async connect(): Promise<string> {
    await this.connector.connect();
    return this.connector.accounts[0];
  }
  
  async signTransaction(transaction: any): Promise<string> {
    const provider = new ethers.providers.Web3Provider(this.connector);
    const signer = provider.getSigner();
    const tx = await signer.sendTransaction(transaction);
    return tx.hash;
  }
}
```

---

## 🔒 **Security Considerations**

### **Authentication & Authorization**
- All DAO operations require valid Firebase JWT
- Check DAO membership before allowing operations
- Validate user permissions for admin functions

### **Wallet Security**
- Encrypt private keys before storing in Firestore
- Use hardware security modules for production
- Implement key rotation for production

### **Transaction Security**
- Implement nonce management to prevent replay attacks
- Validate transaction parameters before execution
- Implement gas limits to prevent abuse

### **Data Validation**
- Sanitize all user inputs
- Validate blockchain addresses
- Check for SQL injection in Firestore queries

---

## 📊 **Performance Optimization**

### **Caching Strategy**
```typescript
// Cache frequently accessed data
const cache = {
  daoMetadata: new Map<string, any>(),
  userMemberships: new Map<string, string[]>(),
  proposalStatus: new Map<string, string>()
};
```

### **Batch Operations**
```typescript
// Batch Firestore operations
const batch = db.batch();
batch.set(daoRef, daoData);
batch.update(userRef, userData);
await batch.commit();
```

### **Pagination**
```typescript
// Implement pagination for all listing operations
const getProposals = async (daoAddress: string, page: number, pageSize: number) => {
  const snapshot = await db.collection(`daos/${daoAddress}/proposals`)
    .orderBy('createdAt', 'desc')
    .limit(pageSize)
    .offset(page * pageSize)
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
```

---

## 🧪 **Testing Strategy**

### **Unit Tests**
```typescript
// tests/blockchainService.test.ts
describe('BlockchainService', () => {
  it('should create DAO successfully', async () => {
    const service = new BlockchainService();
    const daoAddress = await service.createDAO('Test DAO', 'Description', [], [], TOKEN_ADDRESS);
    expect(daoAddress).toBeDefined();
  });
});
```

### **Integration Tests**
```typescript
// tests/daoIntegration.test.ts
describe('DAO Integration', () => {
  it('should create DAO in simple mode and store in Firestore', async () => {
    const response = await request(app)
      .post('/api/daos')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test DAO', description: 'Test', mode: 'simple' });
    
    expect(response.status).toBe(201);
    expect(response.body.daoAddress).toBeDefined();
    expect(response.body.mode).toBe('simple');
    
    // Check Firestore
    const daoDoc = await db.collection('daos').doc(response.body.daoAddress).get();
    expect(daoDoc.exists).toBe(true);
    expect(daoDoc.data()?.metadata?.mode).toBe('simple');
  });
});
```

### **End-to-End Tests**
```typescript
// tests/e2e/daoWorkflow.test.ts
describe('DAO Workflow E2E', () => {
  it('should complete full DAO lifecycle in simple mode', async () => {
    // 1. Create DAO in simple mode
    // 2. Add members
    // 3. Create proposal
    // 4. Vote on proposal
    // 5. Execute proposal
    // 6. Verify blockchain state
    // 7. Verify Firestore state
  });
  
  it('should complete full DAO lifecycle in advanced mode', async () => {
    // 1. Connect external wallet
    // 2. Create DAO in advanced mode
    // 3. Add members
    // 4. Create proposal (user signs)
    // 5. Vote on proposal (user signs)
    // 6. Execute proposal (user signs)
    // 7. Verify blockchain state
    // 8. Verify Firestore state
  });
});
```

---

## 🚀 **Deployment Checklist**

### **Pre-Deployment**
- [ ] Deploy smart contracts to Hardhat local network
- [ ] Update contract addresses in environment variables
- [ ] Test all contract interactions
- [ ] Verify relayer contract functionality
- [ ] Test gas management system
- [ ] Test wallet creation and encryption

### **Backend Deployment**
- [ ] Add new dependencies to package.json
- [ ] Update environment variables
- [ ] Deploy to development environment
- [ ] Run integration tests
- [ ] Test with real blockchain transactions
- [ ] Test dual-mode functionality

### **Production Considerations**
- [ ] Deploy contracts to testnet (Sepolia/Goerli)
- [ ] Implement proper error handling
- [ ] Add monitoring and logging
- [ ] Set up gas fee management
- [ ] Implement rate limiting
- [ ] Set up wallet encryption keys

---

## 📈 **Success Metrics**

### **User Adoption**
- Number of DAOs created
- Active users per DAO
- Proposal participation rates
- User mode preferences (simple vs advanced)

### **Technical Performance**
- Transaction success rates
- Average gas costs
- API response times
- Firestore operation efficiency

### **Business Metrics**
- Revenue from premium features
- User retention rates
- Platform usage growth
- Community engagement

---

## 🎯 **Key Benefits of This Approach**

1. **Maximum User Adoption**: Simple mode for mainstream users
2. **True Decentralization**: Advanced mode for crypto purists
3. **Flexible Architecture**: Users can participate in both types of DAOs
4. **Gradual Learning**: Users can start simple and advance
5. **DAO Creator Choice**: Creators choose the experience for their community
6. **Cost Transparency**: Advanced users see real costs
7. **Future-Proof**: Can evolve with user needs

---

## 📞 **Support & Maintenance**

### **Monitoring**
- Monitor gas usage and costs
- Track transaction success rates
- Monitor Firestore read/write operations
- Set up alerts for failed transactions

### **Debugging**
- Log all blockchain transactions
- Store transaction receipts in Firestore
- Implement transaction status tracking
- Add detailed error logging

### **Updates**
- Plan for contract upgrades
- Implement data migration strategies
- Maintain backward compatibility
- Regular security audits

---

This comprehensive plan provides a complete roadmap for building a robust, user-friendly DAO platform that can scale from simple to advanced use cases while maintaining the flexibility to serve different user types and preferences. 