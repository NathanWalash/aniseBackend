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

    // 2. Parse logs to verify createAnnouncement function call
    const iface = new ethers.Interface(AnnouncementModuleAbi.abi);
    const logs = receipt.logs;
    let announcementId: number | null = null;
    
    for (const log of logs) {
      try {
        const parsedLog = iface.parseLog(log);
        if (parsedLog && parsedLog.name === 'AnnouncementCreated') {
          announcementId = parsedLog.args.announcementId;
          break;
        }
      } catch (e) {
        // Skip logs that don't match our interface
        continue;
      }
    }

    if (announcementId === null) {
      throw new Error('Announcement creation not found in transaction logs');
    }

    // 3. Store in Firestore
    const announcementData: Omit<Announcement, 'announcementId'> = {
      title,
      content,
      announcementType: ['GENERAL', 'URGENT', 'INFO'][announcementType] as Announcement['announcementType'],
      creator: req.user?.wallet?.address || '',
      expiresAt,
      createdAt: admin.firestore.Timestamp.now() as any,
      txHash
    };

    await db.collection('daos')
      .doc(daoAddress)
      .collection('announcements')
      .doc(announcementId.toString())
      .set(announcementData);

    res.json({ 
      announcementId: announcementId.toString(), 
      announcement: { announcementId: announcementId.toString(), ...announcementData }
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