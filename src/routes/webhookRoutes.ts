import { Router } from 'express';
import { handleGoCardlessWebhook } from '../controllers/webhookController';

const router = Router();

router.post('/webhook', handleGoCardlessWebhook);

export default router; 