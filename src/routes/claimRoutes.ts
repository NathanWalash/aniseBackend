import { Router } from 'express';
import { listClaims, getClaim, getClaimVotes } from '../controllers/claimController';

const router = Router();

// POST /api/daos/:daoAddress/claims - Create claim
// TODO: Accept tx hash, verify, add to Firestore
router.post('/:daoAddress/claims', (req, res) => {
  // TODO: Implement create claim logic
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/daos/:daoAddress/claims - List claims
router.get('/:daoAddress/claims', listClaims);
// GET /api/daos/:daoAddress/claims/:claimId - Claim details
router.get('/:daoAddress/claims/:claimId', getClaim);
// GET /api/daos/:daoAddress/claims/:claimId/votes - List votes on a claim
router.get('/:daoAddress/claims/:claimId/votes', getClaimVotes);

// POST /api/daos/:daoAddress/claims/:claimId/vote - Vote on claim
// TODO: Accept tx hash, verify, update Firestore, check for payout
router.post('/:daoAddress/claims/:claimId/vote', (req, res) => {
  // TODO: Implement vote on claim
  res.status(501).json({ error: 'Not implemented' });
});

export default router; 