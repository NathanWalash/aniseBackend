import { Router } from 'express';
import { createDao } from '../controllers/daoController';

const router = Router();

// POST /api/daos - Create DAO
router.post('/', createDao);

// GET /api/daos - List/search all DAOs
// TODO: Query Firestore, support filters/pagination
router.get('/', (req, res) => {
  // TODO: Implement list/search DAOs
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/daos/:daoAddress - Get DAO metadata/details
// TODO: Fetch from Firestore
router.get('/:daoAddress', (req, res) => {
  // TODO: Implement get DAO details
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/daos/:daoAddress/modules - List modules for this DAO
// TODO: Fetch from Firestore
router.get('/:daoAddress/modules', (req, res) => {
  // TODO: Implement get DAO modules
  res.status(501).json({ error: 'Not implemented' });
});

export default router; 