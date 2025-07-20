import { Router } from 'express';

const router = Router();

// POST /api/daos/:daoAddress/join-requests - Request to join DAO
// TODO: Accept tx hash, verify, add to Firestore
router.post('/:daoAddress/join-requests', (req, res) => {
  // TODO: Implement join request logic
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/daos/:daoAddress/members - List members
// TODO: Fetch from Firestore
router.get('/:daoAddress/members', (req, res) => {
  // TODO: Implement list members
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/daos/:daoAddress/join-requests - List pending join requests
// TODO: Fetch from Firestore
router.get('/:daoAddress/join-requests', (req, res) => {
  // TODO: Implement list join requests
  res.status(501).json({ error: 'Not implemented' });
});

// POST /api/daos/:daoAddress/join-requests/:requestId/approve - Approve join request
// TODO: Accept tx hash, verify, update Firestore
router.post('/:daoAddress/join-requests/:requestId/approve', (req, res) => {
  // TODO: Implement approve join request
  res.status(501).json({ error: 'Not implemented' });
});

// POST /api/daos/:daoAddress/join-requests/:requestId/reject - Reject join request
// TODO: Accept tx hash, verify, update Firestore
router.post('/:daoAddress/join-requests/:requestId/reject', (req, res) => {
  // TODO: Implement reject join request
  res.status(501).json({ error: 'Not implemented' });
});

export default router; 