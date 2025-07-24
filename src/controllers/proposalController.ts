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
  };
}

interface ContractEvent {
  event: string;
  args: any[];
}

// GET /api/daos/:daoAddress/proposals - List all proposals
// Returns all proposals (status, threshold, votes, etc.) from 'daos/{daoAddress}/proposals'.
export const listProposals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const { limit = 20, startAfter } = req.query;
    let query = db.collection('daos').doc(daoAddress).collection('proposals').orderBy('createdAt', 'desc').limit(Number(limit));
    if (startAfter) {
      const startDoc = await db.collection('daos').doc(daoAddress).collection('proposals').doc(String(startAfter)).get();
      if (startDoc.exists) query = query.startAfter(startDoc);
    }
    const snapshot = await query.get();
    const proposals = snapshot.docs.map(doc => ({ proposalId: doc.id, ...doc.data() }));
    res.json({ proposals });
  } catch (err: any) {
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
export const voteOnProposal = async (req: Request, res: Response): Promise<void> => {
  // TODO: Verify tx, extract voter, vote type (approve/reject)
  // TODO: Update votes object in proposal doc, increment approvals/rejections
  // TODO: If approvals or rejections meet threshold, update status to 'approved' or 'rejected'
  res.status(501).json({ error: 'Not implemented' });
}; 