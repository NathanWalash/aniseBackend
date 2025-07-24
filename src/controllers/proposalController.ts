import { Request, Response } from 'express';
import admin from 'firebase-admin';
import { verifyTransaction } from '../utils/verifyTransaction';
import { ethers } from 'ethers';
import ProposalVotingModuleAbi from '../abis/ProposalVotingModule.json';

const db = admin.firestore();
const AMOY_RPC_URL = 'https://polygon-amoy.infura.io/v3/e3899c2e9571490db9a718222ccf6649';

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    wallet?: {
      address: string;
    };
  };
}

interface ContractEvent {
  event: string;
  args: any[];
}

// GET /api/daos/:daoAddress/proposals - List all proposals
export const listProposals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    
    // Use Firestore subcollection pattern
    const snapshot = await db.collection('daos')
      .doc(daoAddress)
      .collection('proposals')
      .orderBy('createdAt', 'desc')
      .get();
    
    // Map with ID included
    const proposals = snapshot.docs.map(doc => ({
      proposalId: doc.id,
      ...doc.data()
    }));

    // Always wrap in named field
    res.json({ proposals });
  } catch (err: any) {
    console.error('Error in listProposals:', err);
    // Always use json() for errors
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/proposals/:proposalId - Proposal details
// Returns a single proposal's details from 'daos/{daoAddress}/proposals/{proposalId}'.
export const getProposal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress, proposalId } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('proposals').doc(proposalId).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ proposalId: doc.id, ...doc.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/proposals/:proposalId/votes - List votes on a proposal
// Returns the full votes object for a proposal from 'votes' field in 'daos/{daoAddress}/proposals/{proposalId}'.
export const getProposalVotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress, proposalId } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('proposals').doc(proposalId).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const data = doc.data();
    res.json({ votes: data?.votes || {} });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createProposal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const { title, description, txHash } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // 1. Get the transaction receipt for sender verification
    const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error('Transaction not found');
    }
    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    // 2. Get the event args
    const eventArgs = await verifyTransaction({
      txHash,
      expectedEventSig: 'ProposalCreated(uint256,address,string,string)',
      abi: ProposalVotingModuleAbi.abi
    });

    // 3. Extract data from event args (returned in order of parameters)
    const proposalId = eventArgs[0].toString();  // uint256 proposalId
    const proposer = eventArgs[1];               // address proposer
    const eventTitle = eventArgs[2];             // string title
    const eventDescription = eventArgs[3];       // string description

    // 4. Verify the transaction sender matches the proposer
    if (ethers.getAddress(proposer) !== ethers.getAddress(receipt.from)) {
      throw new Error('Transaction sender mismatch');
    }

    // 5. Verify the event data matches the request
    if (title !== eventTitle || description !== eventDescription) {
      throw new Error('Event data mismatch with request');
    }

    // 6. Create the proposal document in Firestore
    const docRef = db.collection('daos')
      .doc(daoAddress)
      .collection('proposals')
      .doc(proposalId);

    await docRef.set({
      proposalId: Number(proposalId),
      proposer,
      title: eventTitle,
      description: eventDescription,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      votes: {},
      voters: {},
      txHash,
      createdBy: userId
    });

    console.log('Successfully created proposal:', {
      daoAddress,
      proposalId,
      proposer,
      userId
    });

    res.json({ 
      success: true, 
      proposalId,
      txHash 
    });

  } catch (err: any) {
    console.error('Error creating proposal:', err);
    res.status(500).json({ 
      error: err.message,
      details: err.details || err.stack
    });
  }
};

// POST /api/daos/:daoAddress/proposals/:proposalId/vote - Vote on proposal
// Frontend: User votes on a proposal after sending blockchain tx. Backend verifies tx, updates votes object, approvals/rejections, and checks threshold to update status.
export const voteOnProposal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress, proposalId } = req.params;
    const { txHash, voteType } = req.body; // voteType will be 'approve' or 'reject'
    const userId = req.user?.uid;
    const userWallet = req.user?.wallet?.address;

    if (!userId || !txHash || !voteType) {
      res.status(401).json({ error: 'Not authenticated or missing txHash/voteType' });
      return;
    }

    if (!userWallet) {
      res.status(400).json({ error: 'No wallet linked to user' });
      return;
    }

    // Get proposal doc to verify it exists and is pending
    const proposalDoc = await db.collection('daos')
      .doc(daoAddress)
      .collection('proposals')
      .doc(proposalId)
      .get();

    if (!proposalDoc.exists) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    const proposalData = proposalDoc.data();
    if (proposalData?.status !== 'pending') {
      res.status(400).json({ error: 'Proposal is not pending' });
      return;
    }

    // Check if user is the proposer
    if (ethers.getAddress(proposalData.proposer) === ethers.getAddress(userWallet)) {
      res.status(400).json({ error: 'Proposer cannot vote on their own proposal' });
      return;
    }

    // Check if user has already voted
    if (proposalData.voters?.[userWallet]) {
      res.status(400).json({ error: 'Already voted on this proposal' });
      return;
    }

    // 1. Get the transaction receipt
    const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error('Transaction not found');
    }
    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    // 2. Get the VoteCast event args
    const voteEventArgs = await verifyTransaction({
      txHash,
      expectedEventSig: 'VoteCast(uint256,address,bool)',
      abi: ProposalVotingModuleAbi.abi
    });

    // 3. Extract vote data
    const eventProposalId = voteEventArgs[0].toString();
    const voter = voteEventArgs[1];
    const approve = voteEventArgs[2];

    // 4. Verify data matches
    if (eventProposalId !== proposalId) {
      throw new Error('Proposal ID mismatch');
    }
    if (ethers.getAddress(voter) !== ethers.getAddress(userWallet)) {
      throw new Error('Voter address mismatch');
    }
    if ((voteType === 'approve' && !approve) || (voteType === 'reject' && approve)) {
      throw new Error('Vote type mismatch');
    }

    // 5. Check for ProposalFinalized event in the same transaction
    const iface = new ethers.Interface(ProposalVotingModuleAbi.abi);
    let isFinalized = false;
    let finalizedStatus = null;

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === 'ProposalFinalized') {
          const [, status] = parsed.args;
          isFinalized = true;
          // Status enum in contract: { Pending = 0, Approved = 1, Rejected = 2 }
          finalizedStatus = status === 1 ? 'approved' : 'rejected';
          break;
        }
      } catch (e) { /* not this event */ }
    }

    // 6. Update Firestore
    const updateData: any = {
      [`votes.${userWallet}`]: {
        vote: approve,
        votedAt: admin.firestore.FieldValue.serverTimestamp(),
        txHash
      },
      [`voters.${userWallet}`]: true
    };

    if (isFinalized) {
      updateData.status = finalizedStatus;
      updateData.finalizedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.finalizedTxHash = txHash;
    }

    await proposalDoc.ref.update(updateData);

    res.json({ 
      success: true,
      isFinalized,
      status: isFinalized ? finalizedStatus : 'pending'
    });

  } catch (err: any) {
    console.error('Error voting on proposal:', err);
    res.status(500).json({ 
      error: err.message,
      details: err.details || err.stack
    });
  }
}; 