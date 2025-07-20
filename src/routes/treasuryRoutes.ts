import { Router } from 'express';
import { getTreasury, listTreasuryTransactions, withdrawTreasury, depositTreasury } from '../controllers/treasuryController';

const router = Router();

// GET /api/daos/:daoAddress/treasury - Treasury info
router.get('/:daoAddress/treasury', getTreasury);
// GET /api/daos/:daoAddress/treasury/transactions - List treasury transactions
router.get('/:daoAddress/treasury/transactions', listTreasuryTransactions);
// POST /api/daos/:daoAddress/treasury/withdraw - Manual/admin withdrawals
// Frontend: Admin initiates withdrawal after blockchain tx.
router.post('/:daoAddress/treasury/withdraw', withdrawTreasury);
// POST /api/daos/:daoAddress/treasury/deposit - Deposit funds
// Frontend: User/admin deposits funds after blockchain tx.
router.post('/:daoAddress/treasury/deposit', depositTreasury);

export default router; 