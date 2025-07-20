import { Router } from 'express';
import { getUserDaos, getUserTokenBalance, getUserNotifications } from '../controllers/userController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = Router();

router.post('/wallet/connect', verifyFirebaseToken, connectWallet);

// GET /api/users/:userId/daos - List DAOs a user is a member/admin of
router.get('/:userId/daos', getUserDaos);
// GET /api/users/:userId/token-balance - Get user's token balance (live from Amoy RPC)
router.get('/:userId/token-balance', getUserTokenBalance);
// GET /api/users/:userId/notifications - List notifications for a user (future)
router.get('/:userId/notifications', getUserNotifications);

export default router; 