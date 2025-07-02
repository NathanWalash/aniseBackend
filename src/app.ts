import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import paymentRoutes from './routes/paymentRoutes';
import webhookRoutes from './routes/webhookRoutes';

const app = express();

app.use(cors());
app.use(express.json());

// Mount routers
app.use('/api/payment', webhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', paymentRoutes);
// TODO: Add more routers as needed

export default app; 