import { Router } from 'express';
import { getTreasury, listTreasuryTransactions } from '../controllers/treasuryController';

const router = Router();

// GET /api/daos/:daoAddress/treasury - Treasury info
router.get('/:daoAddress/treasury', getTreasury);
// GET /api/daos/:daoAddress/treasury/transactions - List treasury transactions
router.get('/:daoAddress/treasury/transactions', listTreasuryTransactions);

export default router; 