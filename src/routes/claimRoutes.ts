import { Router } from 'express';
import { createClaim, voteOnClaim, listClaims, payoutClaim } from '../controllers/claimController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = Router();

// Protected routes - require authentication
router.use(verifyFirebaseToken);

// GET endpoint before POST
router.get('/:daoAddress/claims', listClaims);

// POST /api/daos/:daoAddress/claims - Create a new claim
router.post('/:daoAddress/claims', createClaim);

// POST /api/daos/:daoAddress/claims/:claimId/vote - Vote on a claim
router.post('/:daoAddress/claims/:claimId/vote', voteOnClaim);

// POST /api/daos/:daoAddress/claims/:claimId/payout - Payout an approved claim
router.post('/:daoAddress/claims/:claimId/payout', payoutClaim);

export default router; 