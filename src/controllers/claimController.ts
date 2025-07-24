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