import { Request, Response } from 'express';
import admin from 'firebase-admin';
import { verifyTransaction } from '../utils/verifyTransaction';
import { ethers } from 'ethers';
import DocumentSigningModuleAbi from '../abis/DocumentSigningModule.json';

const db = admin.firestore();
const AMOY_RPC_URL = 'https://polygon-amoy.infura.io/v3/e3899c2e9571490db9a718222ccf6649';

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    wallet?: {
      address: string;
    };
  };
}

interface Document {
  documentId: string;
  ipfsHash: string;
  title: string;
  description: string;
  creator: string;
  requiredSigners: string[];
  signedCount: number;
  isExecuted: boolean;
  createdAt: {
    _seconds: number;
    _nanoseconds: number;
  };
  executedAt?: {
    _seconds: number;
    _nanoseconds: number;
  };
  txHash: string;
}

interface Signature {
  signerAddress: string;
  timestamp: {
    _seconds: number;
    _nanoseconds: number;
  };
  txHash: string;
}

// GET /api/daos/:daoAddress/documents - List all documents (PAGINATED)
export const listDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Use Firestore subcollection pattern with pagination
    const snapshot = await db.collection('daos')
      .doc(daoAddress)
      .collection('documents')
      .orderBy('createdAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();
    
    // Get total count
    const totalSnapshot = await db.collection('daos')
      .doc(daoAddress)
      .collection('documents')
      .count()
      .get();
    
    // Map with ID included
    const documents = snapshot.docs.map(doc => ({
      documentId: doc.id,
      ...doc.data()
    }));

    // Always wrap in named field
    res.json({ documents });
  } catch (err: any) {
    console.error('Error in listDocuments:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/documents/pending - List pending documents
export const listPendingDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Get pending documents (isExecuted: false)
    const snapshot = await db.collection('daos')
      .doc(daoAddress)
      .collection('documents')
      .where('isExecuted', '==', false)
      .orderBy('createdAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();
    
    const documents = snapshot.docs.map(doc => ({
      documentId: doc.id,
      ...doc.data()
    })) as Document[];

    res.json({ 
      documents,
      offset,
      limit
    });
  } catch (err: any) {
    console.error('Error in listPendingDocuments:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/documents/executed - List executed documents
export const listExecutedDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Get executed documents (isExecuted: true)
    const snapshot = await db.collection('daos')
      .doc(daoAddress)
      .collection('documents')
      .where('isExecuted', '==', true)
      .orderBy('createdAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();
    
    const documents = snapshot.docs.map(doc => ({
      documentId: doc.id,
      ...doc.data()
    })) as Document[];

    res.json({ 
      documents,
      offset,
      limit
    });
  } catch (err: any) {
    console.error('Error in listExecutedDocuments:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/documents/:documentId - Get specific document
export const getDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress, documentId } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('documents').doc(documentId).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    
    res.json({ documentId: doc.id, ...doc.data() });
  } catch (err: any) {
    console.error('Error in getDocument:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/daos/:daoAddress/documents - Create new document
export const createDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const { ipfsHash, title, description, requiredSigners, txHash } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // 1. Verify the transaction on blockchain
    const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error('Transaction not found');
    }
    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    // 2. Parse logs to verify createDocument function call
    const iface = new ethers.Interface(DocumentSigningModuleAbi.abi);
    const logs = receipt.logs;
    let documentId: number | null = null;
    
    for (const log of logs) {
      try {
        const parsedLog = iface.parseLog(log);
        if (parsedLog && parsedLog.name === 'DocumentCreated') {
          documentId = parsedLog.args.documentId;
          break;
        }
      } catch (e) {
        // Skip logs that don't match our interface
        continue;
      }
    }

    if (documentId === null) {
      throw new Error('Document creation not found in transaction logs');
    }

    // 3. Store in Firestore
    const documentData: Omit<Document, 'documentId'> = {
      ipfsHash,
      title,
      description,
      creator: req.user?.wallet?.address || '',
      requiredSigners,
      signedCount: 0,
      isExecuted: false,
      createdAt: admin.firestore.Timestamp.now() as any,
      txHash
    };

    await db.collection('daos')
      .doc(daoAddress)
      .collection('documents')
      .doc(documentId.toString())
      .set(documentData);

    res.json({ 
      documentId: documentId.toString(), 
      document: { documentId: documentId.toString(), ...documentData }
    });
  } catch (err: any) {
    console.error('Error in createDocument:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/daos/:daoAddress/documents/:documentId/sign - Sign document
export const signDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress, documentId } = req.params;
    const { txHash } = req.body;
    const userId = req.user?.uid;
    const signerAddress = req.user?.wallet?.address;

    if (!userId || !signerAddress) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // 1. Verify the transaction on blockchain
    const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error('Transaction not found');
    }
    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    // 2. Parse logs to verify signDocument function call
    const iface = new ethers.Interface(DocumentSigningModuleAbi.abi);
    const logs = receipt.logs;
    let documentSigned = false;
    let documentExecuted = false;
    
    for (const log of logs) {
      try {
        const parsedLog = iface.parseLog(log);
        if (parsedLog) {
          if (parsedLog.name === 'DocumentSigned') {
            documentSigned = true;
          } else if (parsedLog.name === 'DocumentExecuted') {
            documentExecuted = true;
          }
        }
      } catch (e) {
        // Skip logs that don't match our interface
        continue;
      }
    }

    if (!documentSigned) {
      throw new Error('Document signing not found in transaction logs');
    }

    // 3. Update Firestore - add signature
    const signatureData: Signature = {
      signerAddress,
      timestamp: admin.firestore.Timestamp.now() as any,
      txHash
    };

    await db.collection('daos')
      .doc(daoAddress)
      .collection('documents')
      .doc(documentId)
      .collection('signatures')
      .doc(signerAddress)
      .set(signatureData);

    // 4. Update document signed count and execution status
    const updateData: any = {
      signedCount: admin.firestore.FieldValue.increment(1)
    };

    if (documentExecuted) {
      updateData.isExecuted = true;
      updateData.executedAt = admin.firestore.Timestamp.now();
    }

    await db.collection('daos')
      .doc(daoAddress)
      .collection('documents')
      .doc(documentId)
      .update(updateData);

    res.json({ success: true, documentExecuted });
  } catch (err: any) {
    console.error('Error in signDocument:', err);
    res.status(500).json({ error: err.message });
  }
}; 