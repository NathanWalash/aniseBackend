import { Router } from 'express';
import {
  startRedirectFlow,
  confirmRedirectFlow,
  createPayment,
  createSubscription,
  listSubscriptions,
  webhookHandler
} from '../controllers/paymentController';

const router = Router();

router.post('/start-redirect-flow', startRedirectFlow);
router.post('/confirm-redirect-flow', confirmRedirectFlow);
router.post('/create-payment', createPayment);
router.post('/create-subscription', createSubscription);
router.get('/subscriptions', listSubscriptions);
router.post('/webhook', webhookHandler);

export default router; 