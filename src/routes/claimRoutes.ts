import { Router } from 'express';
import { listClaims, getClaim, getClaimVotes, createClaim, voteOnClaim } from '../controllers/claimController';

const router = Router();

// POST /api/daos/:daoAddress/claims - Create claim
// Frontend: User submits claim after blockchain tx.
router.post('/:daoAddress/claims', createClaim);

// GET /api/daos/:daoAddress/claims - List claims
router.get('/:daoAddress/claims', listClaims);
// GET /api/daos/:daoAddress/claims/:claimId - Claim details
router.get('/:daoAddress/claims/:claimId', getClaim);
// GET /api/daos/:daoAddress/claims/:claimId/votes - List votes on a claim
router.get('/:daoAddress/claims/:claimId/votes', getClaimVotes);

// POST /api/daos/:daoAddress/claims/:claimId/vote - Vote on claim
// Frontend: User votes on claim after blockchain tx. Backend must update votes, approvals/rejections, status, and check treasury for payout.
router.post('/:daoAddress/claims/:claimId/vote', voteOnClaim);

export default router; 