import { Request, Response } from 'express';
import admin from '../firebaseAdmin';
import { ethers } from 'ethers';

const db = admin.firestore();
const AMOY_RPC_URL = 'https://polygon-amoy.infura.io/v3/e3899c2e9571490db9a718222ccf6649';

// POST /api/users/wallet/connect
export const connectWallet = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.uid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { address, signature } = req.body;
    if (!address || !signature) {
      res.status(400).json({ error: 'Missing address or signature.' });
      return;
    }
    // Message to sign (should match frontend)
    const message = `Link this wallet to my Anise account at ${user.uid}`;
    // Verify signature
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      res.status(400).json({ error: 'Signature does not match address.' });
      return;
    }
    // Check if address is already linked to another user
    const usersRef = db.collection('users');
    const query = await usersRef.where('wallet.address', '==', address).get();
    if (!query.empty) {
      // If the address is already linked to this user, allow
      const alreadyLinked = query.docs.some(doc => doc.id === user.uid);
      if (!alreadyLinked) {
        res.status(409).json({ error: 'Wallet address already linked to another user.' });
        return;
      }
    }
    // Prevent overwriting wallet address: only allow relinking if address matches
    const userDoc = await usersRef.doc(user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    if (userData?.wallet?.address && userData.wallet.address.toLowerCase() !== address.toLowerCase()) {
      res.status(409).json({ error: 'You already have a wallet linked. Please contact support to change it.' });
      return;
    }
    // Save wallet address to user profile (or relink if same address)
    await usersRef.doc(user.uid).set({
      wallet: {
        address,
        linkedAt: admin.firestore.FieldValue.serverTimestamp(),
      }
    }, { merge: true });
    res.json({ address });
  } catch (err: any) {
    console.error('connectWallet error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/users/:userId/daos - List DAOs a user is a member/admin of
// Returns all DAOs where the user's wallet address is present in the members subcollection.
export const getUserDaos = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    // Get user's wallet address from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    const walletAddress = userDoc.data()?.wallet?.address;
    if (!walletAddress) return res.status(400).json({ error: 'User has no linked wallet' });
    // Query all DAOs and filter for membership
    const daosSnap = await db.collection('daos').get();
    const daos = [];
    for (const daoDoc of daosSnap.docs) {
      const memberDoc = await db.collection('daos').doc(daoDoc.id).collection('members').doc(walletAddress).get();
      if (memberDoc.exists) {
        daos.push({ daoAddress: daoDoc.id, ...daoDoc.data(), role: memberDoc.data()?.role });
      }
    }
    res.json({ daos });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/users/:userId/token-balance - Get user's token balance (live from Amoy RPC)
// Returns the user's token balance by querying the blockchain using their wallet address from Firestore.
export const getUserTokenBalance = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    // Get user's wallet address from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    const walletAddress = userDoc.data()?.wallet?.address;
    if (!walletAddress) return res.status(400).json({ error: 'User has no linked wallet' });
    // Get token address from DAO or config (for now, assume one token)
    // TODO: Make this dynamic if needed
    const tokenAddress = process.env.TOKEN_ADDRESS;
    if (!tokenAddress) return res.status(500).json({ error: 'Token address not configured' });
    const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
    const abi = ["function balanceOf(address) view returns (uint256)"];
    const token = new ethers.Contract(tokenAddress, abi, provider);
    const balance = await token.balanceOf(walletAddress);
    res.json({ walletAddress, tokenAddress, balance: balance.toString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/users/:userId/notifications - List notifications for a user (future)
// Returns all notifications for a user from 'users/{userId}/notifications'.
export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const snapshot = await db.collection('users').doc(userId).collection('notifications').orderBy('timestamp', 'desc').get();
    const notifications = snapshot.docs.map(doc => ({ notificationId: doc.id, ...doc.data() }));
    res.json({ notifications });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}; 