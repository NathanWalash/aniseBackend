import express from 'express';
import { createClaim } from '../controllers/claimController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = express.Router();

// Protected routes - require authentication
router.use(verifyFirebaseToken);

// POST /api/daos/:daoAddress/claims - Create a new claim
router.post('/:daoAddress/claims', createClaim);

export default router; 