import { Request, Response } from 'express';
import { verifyTransaction } from '../utils/verifyTransaction';
import admin from '../firebaseAdmin';
import DaoFactoryAbiJson from '../abis/DaoFactory.json';
import { ethers } from 'ethers';

const db = admin.firestore();
const DaoFactoryAbi = DaoFactoryAbiJson.abi || DaoFactoryAbiJson;

// POST /api/daos - Create DAO
export const createDao = async (req: Request, res: Response) => {
  try {
    const { metadata, txHash, creatorUid } = req.body;
    console.log('[createDao] Received request', { metadata, txHash, creatorUid });
    if (!metadata || !txHash) {
      console.warn('[createDao] Missing metadata or txHash');
      res.status(400).json({ error: 'Missing metadata or txHash' });
      return;
    }
    // 1. Verify transaction
    console.log('[createDao] Verifying transaction on-chain...');
    const receipt = await verifyTransaction({ txHash });
    if (!receipt || !receipt.logs) throw new Error('No logs found in transaction receipt');
    // 2. Parse DaoCreated event
    const iface = new ethers.Interface(DaoFactoryAbi);
    let daoAddress = null;
    let modules = [];
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === 'DaoCreated') {
          daoAddress = parsed.args.dao;
          modules = parsed.args.modules;
          break;
        }
      } catch (e) { /* not this event */ }
    }
    if (!daoAddress) throw new Error('DaoCreated event not found in logs');
    // 3. Store DAO document in Firestore
    const daoDoc = {
      daoAddress,
      creator: receipt.from,
      metadata,
      txHash,
      blockNumber: receipt.blockNumber,
      treasuryModule: modules[modules.length - 1] || '', // last module is usually treasury
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      modules: modules, // for debugging/inspection
    };
    await db.collection('daos').doc(daoAddress).set(daoDoc);
    // 4. Initialize members subcollection with creator as admin
    if (creatorUid && receipt.from) {
      await db.collection('daos').doc(daoAddress).collection('members').doc(receipt.from).set({
        role: 'admin',
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        uid: creatorUid,
      });
    }
    console.log('[createDao] DAO and creator admin written to Firestore', { daoAddress });
    res.status(200).json({ success: true, daoAddress });
  } catch (err: any) {
    console.error('[createDao] Error:', err);
    res.status(400).json({ error: err.message });
  }
}; 