import { Router } from 'express';

const router = Router();

// GET /api/daos/:daoAddress/treasury - Treasury info
// TODO: Fetch from Firestore
router.get('/:daoAddress/treasury', (req, res) => {
  // TODO: Implement get treasury info
  res.status(501).json({ error: 'Not implemented' });
});

// POST /api/daos/:daoAddress/treasury/withdraw - Withdraw funds (admin/manual)
// TODO: Accept tx hash, verify, update Firestore
router.post('/:daoAddress/treasury/withdraw', (req, res) => {
  // TODO: Implement withdraw funds
  res.status(501).json({ error: 'Not implemented' });
});

// POST /api/daos/:daoAddress/treasury/deposit - Deposit funds
// TODO: Accept tx hash, verify, update Firestore
router.post('/:daoAddress/treasury/deposit', (req, res) => {
  // TODO: Implement deposit funds
  res.status(501).json({ error: 'Not implemented' });
});

export default router; 