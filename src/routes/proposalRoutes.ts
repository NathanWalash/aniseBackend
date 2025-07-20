import { Router } from 'express';
import { listProposals, getProposal, getProposalVotes } from '../controllers/proposalController';

const router = Router();

// POST /api/daos/:daoAddress/proposals - Create proposal
// TODO: Accept tx hash, verify, add to Firestore
router.post('/:daoAddress/proposals', (req, res) => {
  // TODO: Implement create proposal logic
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/daos/:daoAddress/proposals - List proposals
router.get('/:daoAddress/proposals', listProposals);
// GET /api/daos/:daoAddress/proposals/:proposalId - Proposal details
router.get('/:daoAddress/proposals/:proposalId', getProposal);
// GET /api/daos/:daoAddress/proposals/:proposalId/votes - List votes on a proposal
router.get('/:daoAddress/proposals/:proposalId/votes', getProposalVotes);

// POST /api/daos/:daoAddress/proposals/:proposalId/vote - Vote on proposal
// TODO: Accept tx hash, verify, update Firestore
router.post('/:daoAddress/proposals/:proposalId/vote', (req, res) => {
  // TODO: Implement vote on proposal
  res.status(501).json({ error: 'Not implemented' });
});

export default router; 