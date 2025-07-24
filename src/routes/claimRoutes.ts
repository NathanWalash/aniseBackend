import express from 'express';
import { listClaims, createClaim } from '../controllers/claimController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = express.Router();

// Protected routes - require authentication
router.use(verifyFirebaseToken);

// GET endpoint before POST
router.get('/:daoAddress/claims', listClaims);
router.post('/:daoAddress/claims', createClaim);

export default router; 