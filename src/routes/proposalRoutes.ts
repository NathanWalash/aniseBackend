import express from 'express';
import { listProposals, createProposal } from '../controllers/proposalController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = express.Router();

// Protected routes - require authentication
router.use(verifyFirebaseToken);

// GET endpoint before POST
router.get('/:daoAddress/proposals', listProposals);
router.post('/:daoAddress/proposals', createProposal);

export default router; 