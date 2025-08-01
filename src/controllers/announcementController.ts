import { Request, Response } from 'express';
import admin from 'firebase-admin';
import { verifyTransaction } from '../utils/verifyTransaction';
import { ethers } from 'ethers';
import AnnouncementModuleAbi from '../abis/AnnouncementModule.json';

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

interface Announcement {
  announcementId: string;
  title: string;
  content: string;
  announcementType: 'GENERAL' | 'URGENT' | 'INFO';
  creator: string;
  expiresAt: number;
  createdAt: {
    _seconds: number;
    _nanoseconds: number;
  };
  txHash: string;
}

// GET /api/daos/:daoAddress/announcements - List active announcements (PAGINATED)
export const listAnnouncements = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;
    const now = admin.firestore.Timestamp.now();
    
    // Get active announcements (expiresAt > now)
    const snapshot = await db.collection('daos')
      .doc(daoAddress)
      .collection('announcements')
      .where('expiresAt', '>', now)
      .orderBy('expiresAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();
    
    const announcements = snapshot.docs.map(doc => ({
      announcementId: doc.id,
      ...doc.data()
    }));

    res.json({ announcements });
  } catch (err: any) {
    console.error('Error in listAnnouncements:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/announcements/:announcementId - Get specific announcement
export const getAnnouncement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress, announcementId } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('announcements').doc(announcementId).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    
    res.json({ announcementId: doc.id, ...doc.data() });
  } catch (err: any) {
    console.error('Error in getAnnouncement:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/daos/:daoAddress/announcements - Create new announcement
export const createAnnouncement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const { title, content, announcementType, expiresAt, txHash } = req.body;
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

    // 2. Get the event args using verifyTransaction utility
    const eventArgs = await verifyTransaction({
      txHash,
      expectedEventSig: 'AnnouncementCreated(uint256,string,address,uint8)',
      abi: AnnouncementModuleAbi.abi
    });

    // 3. Extract data from event args
    const announcementId = eventArgs[0].toString();  // uint256 announcementId
    const eventTitle = eventArgs[1];                 // string title
    const creator = eventArgs[2];                    // address creator
    const eventType = Number(eventArgs[3]);          // uint8 announcementType

    // 4. Verify the transaction sender matches the creator
    if (ethers.getAddress(creator) !== ethers.getAddress(receipt.from)) {
      throw new Error('Transaction sender mismatch');
    }

    // 5. Verify the event data matches the request
    if (title !== eventTitle) {
      throw new Error('Event data mismatch with request');
    }

    // 6. Create the announcement document in Firestore
    const docRef = db.collection('daos')
      .doc(daoAddress)
      .collection('announcements')
      .doc(announcementId);

    const typeNames = ['GENERAL', 'URGENT', 'INFO'];
    await docRef.set({
      announcementId: Number(announcementId),
      creator,
      title: eventTitle,
      content,
      announcementType: typeNames[eventType],
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt * 1000),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      txHash,
      createdBy: userId
    });

    console.log('Successfully created announcement:', {
      daoAddress,
      announcementId,
      creator,
      userId
    });

    res.json({ 
      success: true, 
      announcementId,
      txHash 
    });
  } catch (err: any) {
    console.error('Error in createAnnouncement:', err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/daos/:daoAddress/announcements/:announcementId - Update announcement
export const updateAnnouncement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress, announcementId } = req.params;
    const { title, content, announcementType, expiresAt, txHash } = req.body;
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

    // 2. Update Firestore
    const typeMap = ['GENERAL', 'URGENT', 'INFO'];
    const newType = typeMap[announcementType] as Announcement['announcementType'];
    
    await db.collection('daos')
      .doc(daoAddress)
      .collection('announcements')
      .doc(announcementId)
      .update({
        title,
        content,
        announcementType: newType,
        expiresAt
      });

    // 3. Get updated announcement
    const doc = await db.collection('daos')
      .doc(daoAddress)
      .collection('announcements')
      .doc(announcementId)
      .get();

    res.json({ announcement: { announcementId: doc.id, ...doc.data() } });
  } catch (err: any) {
    console.error('Error in updateAnnouncement:', err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/daos/:daoAddress/announcements/:announcementId - Delete announcement
export const deleteAnnouncement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress, announcementId } = req.params;
    const { txHash } = req.body;
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

    // 2. Delete from Firestore
    await db.collection('daos')
      .doc(daoAddress)
      .collection('announcements')
      .doc(announcementId)
      .delete();

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error in deleteAnnouncement:', err);
    res.status(500).json({ error: err.message });
  }
}; 