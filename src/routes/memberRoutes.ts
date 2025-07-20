import { Router } from 'express';
import { listMembers, getMember, listJoinRequests } from '../controllers/memberController';

const router = Router();

// POST /api/daos/:daoAddress/join-requests - Request to join DAO
// TODO: Accept tx hash, verify, add to Firestore
router.post('/:daoAddress/join-requests', (req, res) => {
  // TODO: Implement join request logic
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/daos/:daoAddress/members - List all members
router.get('/:daoAddress/members', listMembers);
// GET /api/daos/:daoAddress/members/:memberAddress - Member profile/role in DAO
router.get('/:daoAddress/members/:memberAddress', getMember);

// GET /api/daos/:daoAddress/join-requests - List pending join requests
router.get('/:daoAddress/join-requests', listJoinRequests);

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