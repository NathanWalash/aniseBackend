# Anise DAO Integration Plan

## 🎯 **Overview**
This document outlines the comprehensive plan for integrating the Anise smart contract system with the existing Node.js/Express backend. The integration will create a complete DAO (Decentralized Autonomous Organization) platform with dual-mode user experience.

---

## 📋 **Current Backend Status**

### **Existing Infrastructure**
- **Authentication**: Firebase Auth with JWT tokens
- **Database**: Firebase Firestore for user data and caching
- **Payment Processing**: GoCardless integration for direct debit
- **API Structure**: RESTful endpoints with TypeScript
- **Testing**: Jest with comprehensive test coverage

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

## 🏗️ **Smart Contract Architecture**

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
- No wallet setup required
- No gas fees (backend pays)
- Instant transactions
- Centralized but user-friendly

### **Advanced Mode (WalletConnect)**
**Target Users**: Crypto-native users, power users
**Experience**:
- Connect personal wallet (MetaMask, Trust, etc.)
- True decentralization
- User pays gas fees
- Full control over transactions

---

## 🚀 **Implementation Strategy**

### **Phase 1: Foundation (Weeks 1-2)**
**Goal**: Establish blockchain integration layer

#### **1.1 Add Dependencies**
```bash
npm install ethers@5.7.2 web3 @walletconnect/client
npm install --save-dev @types/ethers
```

#### **1.2 Create Blockchain Service Layer**
```typescript
// src/services/blockchainService.ts
import { ethers } from 'ethers';
import { DAO_FACTORY_ABI, DAO_KERNEL_ABI, RELAYER_ABI } from '../contracts/abis';

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
    
    // Extract DAO address from event
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
    // Execute transaction
    // Store transaction record
    // Return transaction hash
  }
  
  async estimateGas(target: string, data: string): Promise<number> {
    // Estimate gas cost for transaction
  }
}
```

#### **1.4 Add Environment Variables**
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
```

### **Phase 2: DAO Management APIs (Weeks 3-4)**
**Goal**: Implement core DAO functionality

#### **2.1 Extend Database Schema**
```typescript
// Firestore Collections Structure
interface FirestoreSchema {
  daos: {
    [daoAddress: string]: {
      metadata: {
        name: string;
        description: string;
        creator: string;
        contractAddress: string;
        createdAt: Timestamp;
        mode: 'simple' | 'advanced';
      };
      members: {
        [address: string]: {
          votingPower: number;
          joinedAt: Timestamp;
          role: 'member' | 'admin';
        };
      };
      proposals: {
        [proposalId: string]: {
          title: string;
          description: string;
          amount: string;
          deadline: Timestamp;
          createdBy: string;
          status: 'active' | 'executed' | 'failed';
          votes: {
            [address: string]: boolean;
          };
          yesVotes: number;
          noVotes: number;
        };
      };
      claims: {
        [claimId: string]: {
          amount: string;
          description: string;
          submitter: string;
          status: 'pending' | 'approved' | 'rejected';
          votes: {
            [address: string]: boolean;
          };
        };
      };
      treasury: {
        balance: string;
        transactions: Array<{
          type: 'deposit' | 'withdrawal';
          amount: string;
          from: string;
          to: string;
          timestamp: Timestamp;
        }>;
      };
    };
  };
  
  users: {
    [userId: string]: {
      profile: {
        // ... existing profile fields
      };
      wallet: {
        address: string;
        encryptedKey?: string; // Only for simple mode
        mode: 'simple' | 'advanced';
        connectedWallet?: string; // For advanced mode
      };
      daos: {
        [daoAddress: string]: {
          role: 'member' | 'admin';
          joinedAt: Timestamp;
        };
      };
    };
  };
  
  relayer: {
    transactions: {
      [hash: string]: {
        userId: string;
        target: string;
        data: string;
        gasUsed: number;
        status: 'pending' | 'confirmed' | 'failed';
        timestamp: Timestamp;
      };
    };
    gas_tracking: {
      dailyUsage: number;
      dailyLimit: number;
      lastReset: Timestamp;
    };
  };
}
```

#### **2.2 Create DAO Routes**
```typescript
// src/routes/daoRoutes.ts
import { Router } from 'express';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';
import { 
  createDAO, 
  getDAOs, 
  getDAO, 
  addMember, 
  removeMember 
} from '../controllers/daoController';

const router = Router();

// All routes require authentication
router.use(verifyFirebaseToken);

// DAO Management
router.post('/create', createDAO);
router.get('/list', getDAOs);
router.get('/:daoAddress', getDAO);

// Member Management
router.post('/:daoAddress/members', addMember);
router.delete('/:daoAddress/members/:address', removeMember);

export default router;
```

#### **2.3 Implement DAO Controller**
```typescript
// src/controllers/daoController.ts
import { Request, Response } from 'express';
import { BlockchainService } from '../services/blockchainService';
import { RelayerService } from '../services/relayerService';
import admin from '../firebaseAdmin';

const db = admin.firestore();
const blockchainService = new BlockchainService();
const relayerService = new RelayerService();

export const createDAO = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, mode = 'simple' } = req.body;
    const userId = (req as any).user.uid;
    
    // Get user profile
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }
    
    // Create DAO on blockchain
    const modules = [MEMBER_MODULE, PROPOSAL_MODULE, CLAIM_MODULE, TREASURY_MODULE];
    const moduleData = ['0x', '0x', '0x', '0x']; // Default initialization data
    
    let daoAddress: string;
    
    if (mode === 'simple') {
      // Use relayer
      daoAddress = await relayerService.executeTransaction(
        userId,
        DAO_FACTORY_ADDRESS,
        blockchainService.encodeCreateDAO(name, description, modules, moduleData, TOKEN_ADDRESS),
        generateNonce()
      );
    } else {
      // User signs directly (advanced mode)
      daoAddress = await blockchainService.createDAO(name, description, modules, moduleData, TOKEN_ADDRESS);
    }
    
    // Store in Firestore
    await db.collection('daos').doc(daoAddress).set({
      metadata: {
        name,
        description,
        creator: userId,
        contractAddress: daoAddress,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        mode
      },
      members: {
        [userData.wallet?.address || userId]: {
          votingPower: 1000, // Default voting power
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
          role: 'admin'
        }
      },
      proposals: {},
      claims: {},
      treasury: {
        balance: '0',
        transactions: []
      }
    });
    
    // Update user's DAO list
    await db.collection('users').doc(userId).update({
      [`daos.${daoAddress}`]: {
        role: 'admin',
        joinedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    });
    
    res.status(201).json({ 
      daoAddress, 
      name, 
      description,
      mode 
    });
    
  } catch (err: any) {
    console.error('Error creating DAO:', err);
    res.status(500).json({ error: err.message });
  }
};
```

### **Phase 3: Proposal & Voting System (Weeks 5-6)**
**Goal**: Implement proposal creation, voting, and execution

#### **3.1 Proposal Routes**
```typescript
// src/routes/proposalRoutes.ts
router.post('/:daoAddress/proposals', createProposal);
router.get('/:daoAddress/proposals', getProposals);
router.get('/:daoAddress/proposals/:proposalId', getProposal);
router.post('/:daoAddress/proposals/:proposalId/vote', voteOnProposal);
router.post('/:daoAddress/proposals/:proposalId/execute', executeProposal);
```

#### **3.2 Proposal Controller**
```typescript
// src/controllers/proposalController.ts
export const createProposal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const { title, description, amount, deadline } = req.body;
    const userId = (req as any).user.uid;
    
    // Check if user is DAO member
    const daoDoc = await db.collection('daos').doc(daoAddress).get();
    const daoData = daoDoc.data();
    
    if (!daoData?.members[userId]) {
      res.status(403).json({ error: 'Not a DAO member' });
      return;
    }
    
    // Create proposal on blockchain
    const proposalId = await blockchainService.createProposal(
      daoAddress, 
      title, 
      description, 
      amount, 
      deadline
    );
    
    // Store in Firestore
    await db.collection(`daos/${daoAddress}/proposals`).doc(proposalId.toString()).set({
      title,
      description,
      amount: amount.toString(),
      deadline: new Date(deadline * 1000),
      createdBy: userId,
      status: 'active',
      votes: {},
      yesVotes: 0,
      noVotes: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.status(201).json({ proposalId: proposalId.toString() });
    
  } catch (err: any) {
    console.error('Error creating proposal:', err);
    res.status(500).json({ error: err.message });
  }
};
```

### **Phase 4: Claim Management (Weeks 7-8)**
**Goal**: Implement claim submission and voting

#### **4.1 Claim Routes**
```typescript
// src/routes/claimRoutes.ts
router.post('/:daoAddress/claims', submitClaim);
router.get('/:daoAddress/claims', getClaims);
router.post('/:daoAddress/claims/:claimId/vote', voteOnClaim);
router.post('/:daoAddress/claims/:claimId/execute', executeClaim);
```

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
        // Payment successful - mint tokens to DAO treasury
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
import WalletConnect from '@walletconnect/client';

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

## 🔧 **Technical Implementation Details**

### **Relayer Contract (New)**
```solidity
// contracts/AniseRelayer.sol
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AniseRelayer is Ownable {
    mapping(address => bool) public authorizedUsers;
    mapping(bytes32 => bool) public executedHashes;
    
    event TransactionExecuted(
        address indexed target,
        bytes data,
        bytes32 indexed nonce,
        bool success
    );
    
    modifier onlyAuthorized() {
        require(authorizedUsers[msg.sender], "Not authorized");
        _;
    }
    
    function addAuthorizedUser(address user) external onlyOwner {
        authorizedUsers[user] = true;
    }
    
    function removeAuthorizedUser(address user) external onlyOwner {
        authorizedUsers[user] = false;
    }
    
    function executeTransaction(
        address target,
        bytes calldata data,
        bytes32 nonce
    ) external onlyAuthorized {
        require(!executedHashes[nonce], "Already executed");
        executedHashes[nonce] = true;
        
        (bool success, ) = target.call(data);
        
        emit TransactionExecuted(target, data, nonce, success);
        require(success, "Transaction failed");
    }
}
```

### **Gas Management System**
```typescript
// src/services/gasManagementService.ts
export class GasManagementService {
  async checkGasLimit(userId: string, estimatedGas: number): Promise<boolean> {
    const dailyUsage = await this.getDailyGasUsage();
    const userUsage = await this.getUserDailyGasUsage(userId);
    
    return dailyUsage + estimatedGas <= DAILY_GAS_LIMIT && 
           userUsage + estimatedGas <= USER_DAILY_GAS_LIMIT;
  }
  
  async trackGasUsage(userId: string, gasUsed: number): Promise<void> {
    await db.collection('relayer').doc('gas_tracking').update({
      dailyUsage: admin.firestore.FieldValue.increment(gasUsed)
    });
    
    await db.collection('users').doc(userId).update({
      dailyGasUsed: admin.firestore.FieldValue.increment(gasUsed)
    });
  }
}
```

### **Event Monitoring System**
```typescript
// src/services/eventMonitorService.ts
export class EventMonitorService {
  async monitorEvents(): Promise<void> {
    const daoFactory = new ethers.Contract(DAO_FACTORY_ADDRESS, DAO_FACTORY_ABI, provider);
    
    daoFactory.on('DAOCreated', async (daoAddress, creator, name, modules, timestamp) => {
      // Update Firestore with new DAO
      await this.updateDAOCache(daoAddress, { creator, name, modules, timestamp });
    });
    
    // Monitor other events...
  }
}
```

---

## 📊 **Database Schema Extensions**

### **New Collections**
```typescript
// Firestore Collections
interface Collections {
  daos: {
    [daoAddress: string]: DAODocument;
  };
  
  relayer: {
    transactions: {
      [hash: string]: TransactionDocument;
    };
    gas_tracking: GasTrackingDocument;
  };
  
  events: {
    [eventId: string]: EventDocument;
  };
}

interface DAODocument {
  metadata: {
    name: string;
    description: string;
    creator: string;
    contractAddress: string;
    createdAt: Timestamp;
    mode: 'simple' | 'advanced';
  };
  members: {
    [address: string]: MemberDocument;
  };
  proposals: {
    [proposalId: string]: ProposalDocument;
  };
  claims: {
    [claimId: string]: ClaimDocument;
  };
  treasury: TreasuryDocument;
}

interface TransactionDocument {
  userId: string;
  target: string;
  data: string;
  gasUsed: number;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Timestamp;
  nonce: string;
}
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
  it('should create DAO and store in Firestore', async () => {
    const response = await request(app)
      .post('/api/dao/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test DAO', description: 'Test' });
    
    expect(response.status).toBe(201);
    expect(response.body.daoAddress).toBeDefined();
    
    // Check Firestore
    const daoDoc = await db.collection('daos').doc(response.body.daoAddress).get();
    expect(daoDoc.exists).toBe(true);
  });
});
```

### **End-to-End Tests**
```typescript
// tests/e2e/daoWorkflow.test.ts
describe('DAO Workflow E2E', () => {
  it('should complete full DAO lifecycle', async () => {
    // 1. Create DAO
    // 2. Add members
    // 3. Create proposal
    // 4. Vote on proposal
    // 5. Execute proposal
    // 6. Verify blockchain state
    // 7. Verify Firestore state
  });
});
```

---

## 🔒 **Security Considerations**

### **Authentication & Authorization**
- All DAO operations require valid Firebase JWT
- Check DAO membership before allowing operations
- Validate user permissions for admin functions

### **Transaction Security**
- Implement nonce management to prevent replay attacks
- Validate transaction parameters before execution
- Implement gas limits to prevent abuse

### **Data Validation**
- Sanitize all user inputs
- Validate blockchain addresses
- Check for SQL injection in Firestore queries

### **Key Management**
- Store relayer private key securely (use environment variables)
- Implement key rotation for production
- Use hardware security modules for production

---

## 📈 **Performance Optimization**

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

## 🚀 **Deployment Checklist**

### **Pre-Deployment**
- [ ] Deploy smart contracts to Hardhat local network
- [ ] Update contract addresses in environment variables
- [ ] Test all contract interactions
- [ ] Verify relayer contract functionality
- [ ] Test gas management system

### **Backend Deployment**
- [ ] Add new dependencies to package.json
- [ ] Update environment variables
- [ ] Deploy to development environment
- [ ] Run integration tests
- [ ] Test with real blockchain transactions

### **Production Considerations**
- [ ] Deploy contracts to testnet (Sepolia/Goerli)
- [ ] Implement proper error handling
- [ ] Add monitoring and logging
- [ ] Set up gas fee management
- [ ] Implement rate limiting

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

## 🎯 **Success Metrics**

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

This comprehensive plan provides a roadmap for integrating the Anise smart contract system with the existing backend, creating a robust and user-friendly DAO platform that can scale from simple to advanced use cases. 