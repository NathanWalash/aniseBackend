import { Router } from 'express';
import { connectWallet, getUserDaos, getUserNotifications } from '../controllers/userController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = Router();

// POST /api/users/wallet/connect - Link wallet to user profile
router.post('/wallet/connect', verifyFirebaseToken, connectWallet);

// GET /api/users/:userId/daos - Get user's DAOs
router.get('/:userId/daos', verifyFirebaseToken, getUserDaos);

// GET /api/users/:userId/notifications - List notifications for a user (future)
router.get('/:userId/notifications', verifyFirebaseToken, getUserNotifications);

export default router; 