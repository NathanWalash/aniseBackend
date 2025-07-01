import { Router } from 'express';
import {
  startRedirectFlow,
  confirmRedirectFlow,
  createPayment,
  createSubscription,
  listSubscriptions,
  webhookHandler
} from '../controllers/paymentController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = Router();

router.post('/start-redirect-flow', verifyFirebaseToken, startRedirectFlow);
router.post('/confirm-redirect-flow', verifyFirebaseToken, confirmRedirectFlow);
router.post('/create-payment', verifyFirebaseToken, createPayment);
router.post('/create-subscription', verifyFirebaseToken, createSubscription);
router.get('/subscriptions', verifyFirebaseToken, listSubscriptions);
router.post('/webhook', webhookHandler);

export default router; 