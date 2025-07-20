import { Router } from 'express';
import { listProposals, getProposal, getProposalVotes, createProposal, voteOnProposal } from '../controllers/proposalController';

const router = Router();

// POST /api/daos/:daoAddress/proposals - Create proposal
// Frontend: User submits proposal after blockchain tx.
router.post('/:daoAddress/proposals', createProposal);

// GET /api/daos/:daoAddress/proposals - List proposals
router.get('/:daoAddress/proposals', listProposals);
// GET /api/daos/:daoAddress/proposals/:proposalId - Proposal details
router.get('/:daoAddress/proposals/:proposalId', getProposal);
// GET /api/daos/:daoAddress/proposals/:proposalId/votes - List votes on a proposal
router.get('/:daoAddress/proposals/:proposalId/votes', getProposalVotes);

// POST /api/daos/:daoAddress/proposals/:proposalId/vote - Vote on proposal
// Frontend: User votes on proposal after blockchain tx. Backend must update votes, approvals/rejections, and status based on threshold.
router.post('/:daoAddress/proposals/:proposalId/vote', voteOnProposal);

export default router; 