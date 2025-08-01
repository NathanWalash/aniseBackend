import { Request, Response } from 'express';
import { verifyTransaction } from '../utils/verifyTransaction';
import admin from '../firebaseAdmin';
import DaoFactoryAbiJson from '../abis/DaoFactory.json';
import DaoKernelAbiJson from '../abis/DaoKernel.json';
import ProposalVotingModuleAbiJson from '../abis/ProposalVotingModule.json';
import ClaimVotingModuleAbiJson from '../abis/ClaimVotingModule.json';
import MemberModuleAbiJson from '../abis/MemberModule.json';
import { ethers } from 'ethers';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();
const DaoFactoryAbi = DaoFactoryAbiJson.abi || DaoFactoryAbiJson;

// POST /api/daos - Create DAO
export const createDao = async (req: Request, res: Response): Promise<void> => {
  try {
    const { metadata, txHash, creatorUid, modules } = req.body;
    // modules: { MemberModule: {config: {...}}, ProposalVotingModule: {config: {...}}, ... }
    console.log('[createDao] Received request', { metadata, txHash, creatorUid, modules });
    if (!metadata || !txHash || !modules) {
      console.warn('[createDao] Missing metadata, txHash, or modules');
      res.status(400).json({ error: 'Missing metadata, txHash, or modules' });
      return;
    }
    // 1. Verify transaction
    console.log('[createDao] Verifying transaction on-chain...');
    const receipt = await verifyTransaction({ txHash });
    if (!receipt || !receipt.logs) throw new Error('No logs found in transaction receipt');
    // 2. Parse DaoCreated event
    const iface = new ethers.Interface(DaoFactoryAbi);
    let daoAddress = null;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === 'DaoCreated') {
          daoAddress = parsed.args.dao;
          break;
        }
      } catch (e) { /* not this event */ }
    }
    if (!daoAddress) throw new Error('DaoCreated event not found in logs');
    // 3. Store DAO document in Firestore, using modules from frontend
    const daoDoc = {
      daoAddress,
      creator: receipt.from,
      metadata,
      txHash,
      blockNumber: receipt.blockNumber,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      modules, // <-- directly from frontend, keyed by module type
      memberCount: 1, // Start with 1 member (the creator)
    };
    await db.collection('daos').doc(daoAddress).set(daoDoc);

    // 4. Add creator as admin member (only need to do this once)
    const creatorAddress = receipt.from;
    if (creatorUid && creatorAddress) {
      const memberRef = db.collection('daos').doc(daoAddress).collection('members').doc(creatorAddress);
      await memberRef.set({
        uid: creatorUid,
        role: 'Admin', // Consistent casing
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5. Update the user's document to include the new DAO
      const userRef = db.collection('users').doc(creatorUid);
      await userRef.update({
        daos: FieldValue.arrayUnion(daoAddress),
      });
    }

    console.log(`[createDao] Successfully cached DAO ${daoAddress} and added creator ${creatorAddress} as admin.`);
    res.status(201).json({ success: true, daoAddress });
  } catch (err: any) {
    console.error('[createDao] Error:', err);
    res.status(400).json({ error: err.message });
  }
};

// GET /api/daos - List/search all DAOs
// Returns a paginated list of all DAOs from the 'daos' collection, with filtering and sorting.
export const listDaos = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      limit = 20, 
      startAfter, 
      search, 
      sortBy = 'recent', 
      memberCount 
    } = req.query;

    console.log('[listDaos] Query params:', { search, sortBy, memberCount, limit });

    // Start with basic query
    let query: admin.firestore.Query<admin.firestore.DocumentData> = db.collection('daos');

    // Apply sorting
    if (sortBy === 'recent') {
      query = query.orderBy('createdAt', 'desc');
    } else if (sortBy === 'popular') {
      // For popular, we'll sort by memberCount in descending order
      query = query.orderBy('memberCount', 'desc');
    } else if (memberCount && memberCount !== 'any') {
      // For member count filters, sort by memberCount in ascending order
      query = query.orderBy('memberCount', 'asc');
    } else {
      // Default to recent
      query = query.orderBy('createdAt', 'desc');
    }

    // Apply limit
    query = query.limit(Number(limit));

    // Apply pagination
    if (startAfter) {
      const startDoc = await db.collection('daos').doc(String(startAfter)).get();
      if (startDoc.exists) query = query.startAfter(startDoc);
    }

    // Get the data
    const snapshot = await query.get();
    let daos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Apply client-side filtering for search and member count
    if (search) {
      const searchLower = String(search).toLowerCase();
      daos = daos.filter((dao: any) => {
        const name = dao.metadata?.name?.toLowerCase() || '';
        const description = dao.metadata?.description?.toLowerCase() || '';
        return name.includes(searchLower) || description.includes(searchLower);
      });
    }

    // Apply member count filtering
    if (memberCount && memberCount !== 'any') {
      daos = daos.filter((dao: any) => {
        const count = dao.memberCount || 1;
        switch (memberCount) {
          case '1-10':
            return count >= 1 && count <= 10;
          case '11-50':
            return count >= 11 && count <= 50;
          case '51-100':
            return count >= 51 && count <= 100;
          case '100+':
            return count > 100;
          default:
            return true;
        }
      });
    }

    console.log(`[listDaos] Returning ${daos.length} DAOs after filtering`);
    res.json({ daos });
  } catch (err: any) {
    console.error('[listDaos] Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress - Get DAO metadata/details
// Returns metadata and config for a single DAO from 'daos/{daoAddress}'.
export const getDao = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/modules - List modules for this DAO
// Returns the modules array (addresses, types, config) for a DAO from 'daos/{daoAddress}.modules'.
export const getDaoModules = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const data = doc.data();
    res.json({ modules: data?.modules || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}; 