import { Router } from 'express';
import { connectWallet } from '../controllers/userController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = Router();

router.post('/wallet/connect', verifyFirebaseToken, connectWallet);

export default router; 