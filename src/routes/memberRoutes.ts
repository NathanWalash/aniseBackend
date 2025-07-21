import { Router } from 'express';
import { listMembers, getMember, listJoinRequests, requestJoin, approveJoinRequest, rejectJoinRequest, changeMemberRole, removeMember } from '../controllers/memberController';

const router = Router();

// POST /api/daos/:daoAddress/join-requests - Request to join DAO
// Frontend: User submits join request after connecting wallet.
router.post('/:daoAddress/join-requests', requestJoin);

// GET /api/daos/:daoAddress/members - List all members
router.get('/:daoAddress/members', listMembers);
// GET /api/daos/:daoAddress/members/:memberAddress - Member profile/role in DAO
router.get('/:daoAddress/members/:memberAddress', getMember);

// GET /api/daos/:daoAddress/join-requests - List pending join requests
router.get('/:daoAddress/join-requests', listJoinRequests);

// POST /api/daos/:daoAddress/join-requests/:requestId/approve - Approve join request (admin)
// Frontend: Admin approves join request.
router.post('/:daoAddress/join-requests/:requestId/approve', approveJoinRequest);

// POST /api/daos/:daoAddress/join-requests/:requestId/reject - Reject join request (admin)
// Frontend: Admin rejects join request.
router.post('/:daoAddress/join-requests/:requestId/reject', rejectJoinRequest);

// POST /api/daos/:daoAddress/members/:memberAddress/role - Change member role (admin only)
// Frontend: Admin changes member role.
router.post('/:daoAddress/members/:memberAddress/role', changeMemberRole);

// POST /api/daos/:daoAddress/members/:memberAddress/remove - Remove member (admin only)
// Frontend: Admin removes member.
router.post('/:daoAddress/members/:memberAddress/remove', removeMember);

export default router; 