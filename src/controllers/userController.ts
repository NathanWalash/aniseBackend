import { Request, Response } from 'express';
import admin from '../firebaseAdmin';
import { verifyMessage } from 'ethers';

const db = admin.firestore();

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
    const recovered = verifyMessage(message, signature);
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