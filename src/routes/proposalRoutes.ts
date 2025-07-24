import { Router } from 'express';
import { createProposal, voteOnProposal, listProposals } from '../controllers/proposalController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = Router();

// Protected routes - require authentication
router.use(verifyFirebaseToken);

// GET endpoint before POST
router.get('/:daoAddress/proposals', listProposals);

// POST /api/daos/:daoAddress/proposals - Create a new proposal
router.post('/:daoAddress/proposals', createProposal);

// POST /api/daos/:daoAddress/proposals/:proposalId/vote - Vote on a proposal
router.post('/:daoAddress/proposals/:proposalId/vote', voteOnProposal);

export default router; 