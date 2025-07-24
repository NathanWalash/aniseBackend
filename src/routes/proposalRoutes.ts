import express from 'express';
import { createProposal } from '../controllers/proposalController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = express.Router();

// Protected routes - require authentication
router.use(verifyFirebaseToken);

// POST /api/daos/:daoAddress/proposals - Create a new proposal
router.post('/:daoAddress/proposals', createProposal);

export default router; 