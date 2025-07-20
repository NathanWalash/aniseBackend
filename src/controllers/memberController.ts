import { Request, Response } from 'express';
import admin from '../firebaseAdmin';

const db = admin.firestore();

// GET /api/daos/:daoAddress/members - List all members
// Returns all members (role, joinedAt, uid) from 'daos/{daoAddress}/members'.
export const listMembers = async (req: Request, res: Response) => {
  try {
    const { daoAddress } = req.params;
    const snapshot = await db.collection('daos').doc(daoAddress).collection('members').get();
    const members = snapshot.docs.map(doc => ({ walletAddress: doc.id, ...doc.data() }));
    res.json({ members });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/members/:memberAddress - Member profile/role in DAO
// Returns a single member's profile/role from 'daos/{daoAddress}/members/{walletAddress}'.
export const getMember = async (req: Request, res: Response) => {
  try {
    const { daoAddress, memberAddress } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('members').doc(memberAddress).get();
    if (!doc.exists) return res.status(404).json({ error: 'Member not found' });
    res.json({ walletAddress: doc.id, ...doc.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/join-requests - List pending join requests
// Returns all join requests (status, uid, timestamps) from 'daos/{daoAddress}/joinRequests'.
export const listJoinRequests = async (req: Request, res: Response) => {
  try {
    const { daoAddress } = req.params;
    const snapshot = await db.collection('daos').doc(daoAddress).collection('joinRequests').get();
    const joinRequests = snapshot.docs.map(doc => ({ walletAddress: doc.id, ...doc.data() }));
    res.json({ joinRequests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}; 