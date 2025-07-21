import { Router } from 'express';
import { createDao, listDaos, getDao, getDaoModules } from '../controllers/daoController';

const router = Router();

// POST /api/daos - Create DAO
router.post('/', createDao);
// GET /api/daos - List/search all DAOs
router.get('/', listDaos);
// GET /api/daos/:daoAddress - Get DAO metadata/details
router.get('/:daoAddress', getDao);
// GET /api/daos/:daoAddress/modules - List modules for this DAO
router.get('/:daoAddress/modules', getDaoModules);

export default router; 