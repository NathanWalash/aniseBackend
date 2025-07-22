import { Router } from 'express';
import { listMembers, listJoinRequests, requestJoin, approveJoinRequest, rejectJoinRequest, changeMemberRole, getJoinRequest, getMember } from '../controllers/memberController';

const router = Router();

// Member routes
router.get('/:daoAddress/members', listMembers);
router.get('/:daoAddress/members/:memberAddress', getMember);

// Join request routes
router.get('/:daoAddress/join-requests', listJoinRequests);
router.get('/:daoAddress/join-requests/:memberAddress', getJoinRequest);
router.post('/:daoAddress/join-requests', requestJoin);
router.post('/:daoAddress/join-requests/:requestId/approve', approveJoinRequest);
router.post('/:daoAddress/join-requests/:requestId/reject', rejectJoinRequest);

// Role management routes
router.post('/:daoAddress/members/:memberAddress/role', changeMemberRole);

export default router; 