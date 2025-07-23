import { Router } from 'express';
import { getTreasury } from '../controllers/treasuryController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = Router();

// Only keep the route for getting treasury module configuration
router.get('/daos/:daoAddress/treasury', verifyFirebaseToken, getTreasury);

export default router; 