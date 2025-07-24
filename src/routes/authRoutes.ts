import { Router } from 'express';
import { login, signup, forgotPassword, getProfile, updateProfile, getUserById } from '../controllers/authController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = Router();

router.post('/login', login);
router.post('/signup', signup);
router.post('/forgot-password', forgotPassword);

// Example protected route
router.get('/me', verifyFirebaseToken, getProfile);
router.put('/me', verifyFirebaseToken, updateProfile);

// Get user by ID (protected)
router.get('/users/:uid', verifyFirebaseToken, getUserById);

export default router; 