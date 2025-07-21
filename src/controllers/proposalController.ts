import { Request, Response } from 'express';
import admin from '../firebaseAdmin';

const db = admin.firestore();

// GET /api/daos/:daoAddress/proposals - List all proposals
// Returns all proposals (status, threshold, votes, etc.) from 'daos/{daoAddress}/proposals'.
export const listProposals = async (req: Request, res: Response): Promise<void> => {
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
// Returns a single proposal's details from 'daos/{daoAddress}/proposals/{proposalId}'.
export const getProposal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress, proposalId } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('proposals').doc(proposalId).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ proposalId: doc.id, ...doc.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/proposals/:proposalId/votes - List votes on a proposal
// Returns the full votes object for a proposal from 'votes' field in 'daos/{daoAddress}/proposals/{proposalId}'.
export const getProposalVotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress, proposalId } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('proposals').doc(proposalId).get();
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

// POST /api/daos/:daoAddress/proposals - Create proposal
// Frontend: User submits a proposal after sending blockchain tx. Backend verifies tx, extracts proposal data, caches threshold, initializes votes object in Firestore.
export const createProposal = async (req: Request, res: Response): Promise<void> => {
  // TODO: Verify tx, extract proposalId, proposer, title, description, threshold from contract/module config
  // TODO: Write proposal doc to 'daos/{daoAddress}/proposals/{proposalId}' with status 'pending', threshold, votes: {}, approvals: 0, rejections: 0
  res.status(501).json({ error: 'Not implemented' });
};

// POST /api/daos/:daoAddress/proposals/:proposalId/vote - Vote on proposal
// Frontend: User votes on a proposal after sending blockchain tx. Backend verifies tx, updates votes object, approvals/rejections, and checks threshold to update status.
export const voteOnProposal = async (req: Request, res: Response): Promise<void> => {
  // TODO: Verify tx, extract voter, vote type (approve/reject)
  // TODO: Update votes object in proposal doc, increment approvals/rejections
  // TODO: If approvals or rejections meet threshold, update status to 'approved' or 'rejected'
  res.status(501).json({ error: 'Not implemented' });
}; 