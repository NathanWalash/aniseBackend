import { Request, Response } from 'express';
import admin from '../firebaseAdmin';

const db = admin.firestore();

// GET /api/daos/:daoAddress/treasury - Treasury module configuration
// Returns treasury module configuration from the DAO document
export const getTreasury = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const daoDoc = await db.collection('daos').doc(daoAddress).get();
    if (!daoDoc.exists) {
      res.status(404).json({ error: 'DAO not found' });
      return;
    }

    const data = daoDoc.data();
    const treasuryModule = data?.modules?.TreasuryModule;
    
    if (!treasuryModule) {
      res.status(404).json({ error: 'Treasury module not found for this DAO' });
      return;
    }

    res.json({
      address: treasuryModule.address,
      ...treasuryModule.config
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}; 