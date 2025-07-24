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
// Returns a paginated list of all DAOs from the 'daos' collection, ordered by creation time.
export const listDaos = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 20, startAfter } = req.query;
    let query = db.collection('daos').orderBy('createdAt', 'desc').limit(Number(limit));
    if (startAfter) {
      const startDoc = await db.collection('daos').doc(String(startAfter)).get();
      if (startDoc.exists) query = query.startAfter(startDoc);
    }
    const snapshot = await query.get();
    const daos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ daos });
  } catch (err: any) {
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