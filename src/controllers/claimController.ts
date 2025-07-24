import { Request, Response } from 'express';
import admin from 'firebase-admin';
import { verifyTransaction } from '../utils/verifyTransaction';
import { ethers } from 'ethers';
import ClaimVotingModuleAbi from '../abis/ClaimVotingModule.json';

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

// GET /api/daos/:daoAddress/claims - List all claims
export const listClaims = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    
    // Use Firestore subcollection pattern
    const snapshot = await db.collection('daos')
      .doc(daoAddress)
      .collection('claims')
      .orderBy('createdAt', 'desc')
      .get();
    
    // Map with ID included
    const claims = snapshot.docs.map(doc => ({
      claimId: doc.id,
      ...doc.data()
    }));

    // Always wrap in named field
    res.json({ claims });
  } catch (err: any) {
    console.error('Error in listClaims:', err);
    // Always use json() for errors
    res.status(500).json({ error: err.message });
  }
};

export const createClaim = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const { title, description, amount, txHash } = req.body;
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
      expectedEventSig: 'ClaimCreated(uint256,address,string,uint256,string)',
      abi: ClaimVotingModuleAbi.abi
    });

    // 3. Extract data from event args (returned in order of parameters)
    const claimId = eventArgs[0].toString();  // uint256 claimId
    const claimant = eventArgs[1];            // address claimant
    const eventTitle = eventArgs[2];          // string title
    const eventAmount = eventArgs[3];         // uint256 amount
    const eventDescription = eventArgs[4];    // string description

    // 4. Verify the transaction sender matches the claimant
    if (ethers.getAddress(claimant) !== ethers.getAddress(receipt.from)) {
      throw new Error('Transaction sender mismatch');
    }

    // 5. Verify the event data matches the request
    if (title !== eventTitle || description !== eventDescription) {
      throw new Error('Event data mismatch with request');
    }

    // 6. Create the claim document in Firestore
    const docRef = db.collection('daos')
      .doc(daoAddress)
      .collection('claims')
      .doc(claimId);

    await docRef.set({
      claimId: Number(claimId),
      claimant,
      title: eventTitle,
      description: eventDescription,
      amount: ethers.formatEther(eventAmount), // Convert wei to ETH
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      votes: {},
      voters: {},
      txHash,
      createdBy: userId
    });

    console.log('Successfully created claim:', {
      daoAddress,
      claimId,
      claimant,
      userId,
      amount: ethers.formatEther(eventAmount)
    });

    res.json({ 
      success: true, 
      claimId,
      txHash 
    });

  } catch (err: any) {
    console.error('Error creating claim:', err);
    res.status(500).json({ 
      error: err.message,
      details: err.details || err.stack
    });
  }
}; 

export const voteOnClaim = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress, claimId } = req.params;
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

    // Get claim doc to verify it exists and is pending
    const claimDoc = await db.collection('daos')
      .doc(daoAddress)
      .collection('claims')
      .doc(claimId)
      .get();

    if (!claimDoc.exists) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }

    const claimData = claimDoc.data();
    if (claimData?.status !== 'pending') {
      res.status(400).json({ error: 'Claim is not pending' });
      return;
    }

    // Check if user is the claimant
    if (ethers.getAddress(claimData.claimant) === ethers.getAddress(userWallet)) {
      res.status(400).json({ error: 'Claimant cannot vote on their own claim' });
      return;
    }

    // Check if user has already voted
    if (claimData.voters?.[userWallet]) {
      res.status(400).json({ error: 'Already voted on this claim' });
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
      abi: ClaimVotingModuleAbi.abi
    });

    // 3. Extract vote data
    const eventClaimId = voteEventArgs[0].toString();
    const voter = voteEventArgs[1];
    const approve = voteEventArgs[2];

    // 4. Verify data matches
    if (eventClaimId !== claimId) {
      throw new Error('Claim ID mismatch');
    }
    if (ethers.getAddress(voter) !== ethers.getAddress(userWallet)) {
      throw new Error('Voter address mismatch');
    }
    if ((voteType === 'approve' && !approve) || (voteType === 'reject' && approve)) {
      throw new Error('Vote type mismatch');
    }

    // 5. Check for ClaimFinalized event in the same transaction
    const iface = new ethers.Interface(ClaimVotingModuleAbi.abi);
    let isFinalized = false;
    let finalizedApproved = false;

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === 'ClaimFinalized') {
          const [, approved] = parsed.args;
          isFinalized = true;
          finalizedApproved = approved;
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
      updateData.status = finalizedApproved ? 'approved' : 'rejected';
      updateData.finalizedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.finalizedTxHash = txHash;
    }

    await claimDoc.ref.update(updateData);

    res.json({ 
      success: true,
      isFinalized,
      status: isFinalized ? (finalizedApproved ? 'approved' : 'rejected') : 'pending'
    });

  } catch (err: any) {
    console.error('Error voting on claim:', err);
    res.status(500).json({ 
      error: err.message,
      details: err.details || err.stack
    });
  }
}; 