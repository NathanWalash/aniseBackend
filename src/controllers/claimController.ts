import { Request, Response } from 'express';
import admin from '../firebaseAdmin';

const db = admin.firestore();

// GET /api/daos/:daoAddress/claims - List all claims
// Returns all claims (status, threshold, votes, etc.) from 'daos/{daoAddress}/claims'.
export const listClaims = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const { limit = 20, startAfter } = req.query;
    let query = db.collection('daos').doc(daoAddress).collection('claims').orderBy('createdAt', 'desc').limit(Number(limit));
    if (startAfter) {
      const startDoc = await db.collection('daos').doc(daoAddress).collection('claims').doc(String(startAfter)).get();
      if (startDoc.exists) query = query.startAfter(startDoc);
    }
    const snapshot = await query.get();
    const claims = snapshot.docs.map(doc => ({ claimId: doc.id, ...doc.data() }));
    res.json({ claims });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/claims/:claimId - Claim details
// Returns a single claim's details from 'daos/{daoAddress}/claims/{claimId}'.
export const getClaim = async (req: Request, res: Response) => {
  try {
    const { daoAddress, claimId } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('claims').doc(claimId).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ claimId: doc.id, ...doc.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/claims/:claimId/votes - List votes on a claim
// Returns the full votes object for a claim from 'votes' field in 'daos/{daoAddress}/claims/{claimId}'.
export const getClaimVotes = async (req: Request, res: Response) => {
  try {
    const { daoAddress, claimId } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('claims').doc(claimId).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const data = doc.data();
    res.json({ votes: data?.votes || {} });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/daos/:daoAddress/claims - Create claim
// Frontend: User submits a claim after sending blockchain tx. Backend verifies tx, extracts claim data, caches threshold, initializes votes object in Firestore.
export const createClaim = async (req: Request, res: Response) => {
  // TODO: Verify tx, extract claimId, claimant, title, amount, description, threshold from contract/module config
  // TODO: Write claim doc to 'daos/{daoAddress}/claims/{claimId}' with status 'pending', threshold, votes: {}, approvals: 0, rejections: 0
  res.status(501).json({ error: 'Not implemented' });
};

// POST /api/daos/:daoAddress/claims/:claimId/vote - Vote on claim
// Frontend: User votes on a claim after sending blockchain tx. Backend verifies tx, updates votes object, approvals/rejections, and checks threshold to update status.
// If claim is approved, backend must also check treasury balance and record payout in Firestore if possible.
export const voteOnClaim = async (req: Request, res: Response) => {
  // TODO: Verify tx, extract voter, vote type (approve/reject)
  // TODO: Update votes object in claim doc, increment approvals/rejections
  // TODO: If approvals or rejections meet threshold, update status to 'approved' or 'rejected'
  // TODO: If approved, check treasury balance and record payout in Firestore
  res.status(501).json({ error: 'Not implemented' });
}; 