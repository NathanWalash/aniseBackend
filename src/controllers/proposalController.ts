import { Request, Response } from 'express';
import admin from '../firebaseAdmin';

const db = admin.firestore();

// GET /api/daos/:daoAddress/proposals - List all proposals (with status, pagination)
export const listProposals = async (req: Request, res: Response) => {
  try {
    const { daoAddress } = req.params;
    const { limit = 20, startAfter } = req.query;
    let query = db.collection('daos').doc(daoAddress).collection('proposals').orderBy('createdAt', 'desc').limit(Number(limit));
    if (startAfter) {
      const startDoc = await db.collection('daos').doc(daoAddress).collection('proposals').doc(String(startAfter)).get();
      if (startDoc.exists) query = query.startAfter(startDoc);
    }
    const snapshot = await query.get();
    const proposals = snapshot.docs.map(doc => ({ proposalId: doc.id, ...doc.data() }));
    res.json({ proposals });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/proposals/:proposalId - Proposal details
export const getProposal = async (req: Request, res: Response) => {
  try {
    const { daoAddress, proposalId } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('proposals').doc(proposalId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Proposal not found' });
    res.json({ proposalId: doc.id, ...doc.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/proposals/:proposalId/votes - List votes on a proposal (if votes are stored)
export const getProposalVotes = async (req: Request, res: Response) => {
  try {
    const { daoAddress, proposalId } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('proposals').doc(proposalId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Proposal not found' });
    const data = doc.data();
    res.json({ votes: data?.votes || {} });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}; 