import { Request, Response } from 'express';
import admin from '../firebaseAdmin';
import { ethers } from 'ethers';

const db = admin.firestore();
const AMOY_RPC_URL = 'https://polygon-amoy.infura.io/v3/e3899c2e9571490db9a718222ccf6649';

// Add at the top of the file after imports
interface DaoMetadata {
  name?: string;
  description?: string;
  templateId?: string;
  mandate?: string;
  intendedAudience?: string;
  isPublic?: boolean;
}

interface DaoData {
  daoAddress: string;
  metadata?: DaoMetadata;
  creator?: string;
  createdAt?: any;
  blockNumber?: number;
  txHash?: string;
  modules?: Record<string, any>;
  memberCount?: number;
  role?: string;
}

// POST /api/users/wallet/connect
export const connectWallet = async (req: Request, res: Response): Promise<void> => {
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

// GET /api/users/:userId/daos - Get user's DAOs
export const getUserDaos = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '10');
    const searchQuery = (req.query.search as string || '').toLowerCase();

    console.log('[getUserDaos] Starting request for userId:', userId);

    // Get user's data from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log('[getUserDaos] User not found:', userId);
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = userDoc.data();
    const walletAddress = userData?.wallet?.address;
    const userDaoAddresses = userData?.daos || [];

    if (!walletAddress) {
      console.log('[getUserDaos] No wallet address for user:', userId);
      res.status(400).json({ error: 'User has no linked wallet' });
      return;
    }

    // Convert wallet address to checksum format for comparison
    const checksumWalletAddress = ethers.getAddress(walletAddress);
    console.log('[getUserDaos] Using checksum wallet address:', checksumWalletAddress);
    console.log('[getUserDaos] User DAOs:', userDaoAddresses);

    const userDaos: DaoData[] = [];

    // Fetch each DAO the user is a member of
    for (const daoAddress of userDaoAddresses) {
      const daoDoc = await db.collection('daos').doc(daoAddress).get();
      
      if (daoDoc.exists) {
        const daoData = daoDoc.data() || {};
        // Use checksum address for member lookup
        const memberDoc = await daoDoc.ref.collection('members').doc(checksumWalletAddress).get();

        if (memberDoc.exists) {
          const memberData = memberDoc.data();
          console.log('[getUserDaos] Found membership in DAO:', {
            daoAddress,
            role: memberData?.role,
            memberData
          });

          // Only add if it matches search query (if any)
          const matchesSearch = !searchQuery || 
            String(daoData?.metadata?.name || '').toLowerCase().includes(searchQuery) ||
            String(daoData?.metadata?.description || '').toLowerCase().includes(searchQuery);

          if (matchesSearch) {
            const memberCount = await daoDoc.ref.collection('members').count().get();
            
            userDaos.push({
              daoAddress: daoDoc.id,
              metadata: daoData.metadata || {},
              creator: daoData.creator,
              createdAt: daoData.createdAt,
              modules: daoData.modules || {},
              role: memberData?.role || 'Member',
              memberCount: memberCount.data().count
            });
          }
        } else {
          console.warn('[getUserDaos] User is in daos array but not in members collection:', {
            daoAddress,
            walletAddress: checksumWalletAddress
          });
        }
      } else {
        console.warn('[getUserDaos] DAO not found:', daoAddress);
      }
    }

    console.log('[getUserDaos] Found user DAOs:', userDaos.length);

    // Sort by creation date (newest first)
    userDaos.sort((a, b) => {
      const dateA = a.createdAt?._seconds || 0;
      const dateB = b.createdAt?._seconds || 0;
      return dateB - dateA;
    });

    // Handle pagination
    const startIndex = (page - 1) * limit;
    const paginatedDaos = userDaos.slice(startIndex, startIndex + limit);

    console.log('[getUserDaos] Returning paginated DAOs:', {
      total: userDaos.length,
      page,
      limit,
      returned: paginatedDaos.length
    });

    res.json({
      daos: paginatedDaos,
      total: userDaos.length,
      hasMore: startIndex + limit < userDaos.length
    });

  } catch (err: any) {
    console.error('[getUserDaos] Error:', err);
    res.status(500).json({ 
      error: err.message,
      details: err.details
    });
  }
};

// GET /api/users/:userId/notifications - List notifications for a user (future)
// Returns all notifications for a user from 'users/{userId}/notifications'.
export const getUserNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const snapshot = await db.collection('users').doc(userId).collection('notifications').orderBy('timestamp', 'desc').get();
    const notifications = snapshot.docs.map(doc => ({ notificationId: doc.id, ...doc.data() }));
    res.json({ notifications });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}; 