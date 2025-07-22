import { Request, Response } from 'express';
import admin from '../firebaseAdmin';

const db = admin.firestore();

// GET /api/daos/:daoAddress/members - List all members
// Returns all members (role, joinedAt, uid) from 'daos/{daoAddress}/members'.
export const listMembers = async (req: Request, res: Response): Promise<void> => {
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
export const getMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress, memberAddress } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('members').doc(memberAddress).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ walletAddress: doc.id, ...doc.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/join-requests - List pending join requests
// Returns all join requests (status, uid, timestamps) from 'daos/{daoAddress}/joinRequests'.
export const listJoinRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const snapshot = await db.collection('daos').doc(daoAddress).collection('joinRequests').get();
    const joinRequests = snapshot.docs.map(doc => ({ walletAddress: doc.id, ...doc.data() }));
    res.json({ joinRequests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/daos/:daoAddress/join-requests - Request to join DAO
// Frontend: User submits a join request after connecting wallet. Backend creates a joinRequest doc with status 'pending'.
export const requestJoin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const { txHash, memberAddress } = req.body;

    console.log('Received join request:', { daoAddress, txHash, memberAddress });

    if (!txHash || !memberAddress) {
      res.status(400).json({ error: 'Missing txHash or memberAddress' });
      return;
    }

    // Get user's UID from auth context
    const uid = (req as any).user?.uid;
    console.log('User UID:', uid);

    // Check if already a member
    const memberDoc = await db.collection('daos').doc(daoAddress).collection('members').doc(memberAddress).get();
    if (memberDoc.exists) {
      console.log('User is already a member');
      res.status(400).json({ error: 'Already a member' });
      return;
    }

    // Check if already has a pending request
    const requestDoc = await db.collection('daos').doc(daoAddress).collection('joinRequests').doc(memberAddress).get();
    if (requestDoc.exists) {
      const data = requestDoc.data();
      if (data?.status === 'pending') {
        console.log('User already has a pending request');
        res.status(400).json({ error: 'Already requested to join' });
        return;
      }
    }

    // Store join request
    const requestData = {
      status: 'pending',
      uid: uid || null, // Make uid optional
      txHash,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      memberAddress // Store this to make queries easier
    };
    console.log('Storing join request:', requestData);

    await db.collection('daos').doc(daoAddress).collection('joinRequests').doc(memberAddress).set(requestData);
    console.log('Join request stored successfully');

    res.json({ status: 'success', data: requestData });
  } catch (err: any) {
    console.error('Error in requestJoin:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/daos/:daoAddress/join-requests/:requestId/approve - Approve join request (admin)
// Frontend: Admin approves a join request. Backend updates joinRequest status to 'approved', sets handledAt, and adds member to members subcollection.
export const approveJoinRequest = async (req: Request, res: Response): Promise<void> => {
  // TODO: Validate admin, update joinRequest status to 'approved', set handledAt
  // TODO: Add member to 'members' subcollection with role 'member' and uid
  res.status(501).json({ error: 'Not implemented' });
};

// POST /api/daos/:daoAddress/join-requests/:requestId/reject - Reject join request (admin)
// Frontend: Admin rejects a join request. Backend updates joinRequest status to 'rejected', sets handledAt.
export const rejectJoinRequest = async (req: Request, res: Response): Promise<void> => {
  // TODO: Validate admin, update joinRequest status to 'rejected', set handledAt
  res.status(501).json({ error: 'Not implemented' });
};

// POST /api/daos/:daoAddress/members/:memberAddress/role - Change member role (admin only)
// Frontend: Admin changes a member's role. Backend updates the member doc's role field.
export const changeMemberRole = async (req: Request, res: Response): Promise<void> => {
  // TODO: Validate admin, update 'role' field in 'members' subcollection
  res.status(501).json({ error: 'Not implemented' });
};

// POST /api/daos/:daoAddress/members/:memberAddress/remove - Remove member (admin only)
// Frontend: Admin removes a member. Backend deletes or updates the member doc.
export const removeMember = async (req: Request, res: Response): Promise<void> => {
  // TODO: Validate admin, remove member from 'members' subcollection
  res.status(501).json({ error: 'Not implemented' });
}; 