import { Router } from 'express';
import { login, signup, forgotPassword, getProfile, updateProfile } from '../controllers/authController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = Router();

router.post('/login', login);
router.post('/signup', signup);
router.post('/forgot-password', forgotPassword);

// Example protected route
router.get('/me', verifyFirebaseToken, getProfile);
router.put('/me', verifyFirebaseToken, updateProfile);

export default router; 