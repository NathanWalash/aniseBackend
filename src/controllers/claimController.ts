import { Request, Response } from 'express';
import admin from '../firebaseAdmin';

const db = admin.firestore();

// GET /api/daos/:daoAddress/claims - List all claims
// Returns all claims (status, threshold, votes, etc.) from 'daos/{daoAddress}/claims'.
export const listClaims = async (req: Request, res: Response) => {
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
    if (!doc.exists) return res.status(404).json({ error: 'Claim not found' });
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
    if (!doc.exists) return res.status(404).json({ error: 'Claim not found' });
    const data = doc.data();
    res.json({ votes: data?.votes || {} });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}; 