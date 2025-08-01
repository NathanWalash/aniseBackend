import { Request, Response } from 'express';
import admin from 'firebase-admin';
import { verifyTransaction } from '../utils/verifyTransaction';
import { ethers } from 'ethers';
import CalendarModuleAbi from '../abis/CalendarModule.json';

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

interface Event {
  eventId: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  location: string;
  creator: string;
  createdBy: string;
  createdAt: {
    _seconds: number;
    _nanoseconds: number;
  };
  txHash: string;
}

// GET /api/daos/:daoAddress/events - List all events (PAGINATED)
export const listEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Use Firestore subcollection pattern with pagination
    const snapshot = await db.collection('daos')
      .doc(daoAddress)
      .collection('events')
      .orderBy('startTime', 'asc')
      .offset(offset)
      .limit(limit)
      .get();
    
    // Get total count
    const totalSnapshot = await db.collection('daos')
      .doc(daoAddress)
      .collection('events')
      .count()
      .get();
    
    // Map with ID included
    const events = snapshot.docs.map(doc => ({
      eventId: doc.id,
      ...doc.data()
    }));

    // Always wrap in named field
    res.json({ events });
  } catch (err: any) {
    console.error('Error in listEvents:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/events/upcoming - Get upcoming events
export const getUpcomingEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const now = admin.firestore.Timestamp.now();
    
    // Get upcoming events (startTime > now)
    const snapshot = await db.collection('daos')
      .doc(daoAddress)
      .collection('events')
      .where('startTime', '>', now)
      .orderBy('startTime', 'asc')
      .limit(limit)
      .get();
    
    const events = snapshot.docs.map(doc => ({
      eventId: doc.id,
      ...doc.data()
    }));

    res.json({ events });
  } catch (err: any) {
    console.error('Error in getUpcomingEvents:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/events/:eventId - Get specific event
export const getEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress, eventId } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('events').doc(eventId).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    
    res.json({ eventId: doc.id, ...doc.data() });
  } catch (err: any) {
    console.error('Error in getEvent:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/daos/:daoAddress/events - Create new event
export const createEvent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const { title, description, startTime, endTime, location, txHash } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // 1. Get the transaction receipt for sender verification
    const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error('Transaction not found');
    }
    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    // 2. Get the event args
    const eventArgs = await verifyTransaction({
      txHash,
      expectedEventSig: 'EventCreated(uint256,string,address,uint256)',
      abi: CalendarModuleAbi.abi
    });

    // 3. Extract data from event args (returned in order of parameters)
    const eventId = eventArgs[0].toString();  // uint256 eventId
    const eventTitle = eventArgs[1];          // string title
    const creator = eventArgs[2];             // address creator
    const eventStartTime = eventArgs[3];      // uint256 startTime

    // 4. Verify the event data matches the request
    if (title !== eventTitle) {
      throw new Error('Event data mismatch with request');
    }

    // 5. Create the event document in Firestore
    const docRef = db.collection('daos')
      .doc(daoAddress)
      .collection('events')
      .doc(eventId);

    await docRef.set({
      eventId: Number(eventId),
      creator,
      createdBy: userId, // Add the Firebase UID
      title: eventTitle,
      description,
      startTime,
      endTime,
      location,
      createdAt: admin.firestore.Timestamp.now(),
      txHash
    });

    res.json({ 
      eventId: eventId.toString(), 
      event: { eventId: eventId.toString(), creator, title: eventTitle, description, startTime, endTime, location, createdAt: admin.firestore.Timestamp.now(), txHash }
    });
  } catch (err: any) {
    console.error('Error in createEvent:', err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/daos/:daoAddress/events/:eventId - Update event
export const updateEvent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress, eventId } = req.params;
    const { title, description, startTime, endTime, location, txHash } = req.body;
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
    await db.collection('daos')
      .doc(daoAddress)
      .collection('events')
      .doc(eventId)
      .update({
        title,
        description,
        startTime,
        endTime,
        location
      });

    // 3. Get updated event
    const doc = await db.collection('daos')
      .doc(daoAddress)
      .collection('events')
      .doc(eventId)
      .get();

    res.json({ event: { eventId: doc.id, ...doc.data() } });
  } catch (err: any) {
    console.error('Error in updateEvent:', err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/daos/:daoAddress/events/:eventId - Delete event
export const deleteEvent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress, eventId } = req.params;
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
      .collection('events')
      .doc(eventId)
      .delete();

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error in deleteEvent:', err);
    res.status(500).json({ error: err.message });
  }
}; 