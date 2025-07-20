import { Router } from 'express';

const router = Router();

// POST /api/daos/:daoAddress/claims - Create claim
// TODO: Accept tx hash, verify, add to Firestore
router.post('/:daoAddress/claims', (req, res) => {
  // TODO: Implement create claim logic
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/daos/:daoAddress/claims - List claims
// TODO: Fetch from Firestore
router.get('/:daoAddress/claims', (req, res) => {
  // TODO: Implement list claims
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/daos/:daoAddress/claims/:claimId - Claim details
// TODO: Fetch from Firestore
router.get('/:daoAddress/claims/:claimId', (req, res) => {
  // TODO: Implement get claim details
  res.status(501).json({ error: 'Not implemented' });
});

// POST /api/daos/:daoAddress/claims/:claimId/vote - Vote on claim
// TODO: Accept tx hash, verify, update Firestore, check for payout
router.post('/:daoAddress/claims/:claimId/vote', (req, res) => {
  // TODO: Implement vote on claim
  res.status(501).json({ error: 'Not implemented' });
});

export default router; 