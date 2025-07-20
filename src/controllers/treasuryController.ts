import { Request, Response } from 'express';
import admin from '../firebaseAdmin';

const db = admin.firestore();

// GET /api/daos/:daoAddress/treasury - Treasury info
// Returns treasury info (token address, balance, last updated) from 'daos/{daoAddress}/treasury'.
export const getTreasury = async (req: Request, res: Response) => {
  try {
    const { daoAddress } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('treasury').doc('treasury').get();
    if (!doc.exists) return res.status(404).json({ error: 'Treasury info not found' });
    res.json({ ...doc.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/treasury/transactions - List treasury transactions
// Returns all treasury transactions (deposits, withdrawals, payouts) from 'daos/{daoAddress}/treasury/transactions'.
export const listTreasuryTransactions = async (req: Request, res: Response) => {
  try {
    const { daoAddress } = req.params;
    const { limit = 20, startAfter } = req.query;
    let query = db.collection('daos').doc(daoAddress).collection('treasury').doc('transactions').collection('transactions').orderBy('timestamp', 'desc').limit(Number(limit));
    if (startAfter) {
      const startDoc = await db.collection('daos').doc(daoAddress).collection('treasury').doc('transactions').collection('transactions').doc(String(startAfter)).get();
      if (startDoc.exists) query = query.startAfter(startDoc);
    }
    const snapshot = await query.get();
    const transactions = snapshot.docs.map(doc => ({ txHash: doc.id, ...doc.data() }));
    res.json({ transactions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}; 