import express from 'express';
import cors from 'cors';
import { verifyFirebaseToken } from './middlewares/verifyFirebaseToken';
import authRoutes from './routes/authRoutes';
import paymentRoutes from './routes/paymentRoutes';
import webhookRoutes from './routes/webhookRoutes';
import userRoutes from './routes/userRoutes';
import daoRoutes from './routes/daoRoutes';
import proposalRoutes from './routes/proposalRoutes';
import claimRoutes from './routes/claimRoutes';
import memberRoutes from './routes/memberRoutes';
import treasuryRoutes from './routes/treasuryRoutes';
import taskRoutes from './routes/taskRoutes';
import calendarRoutes from './routes/calendarRoutes';
import documentRoutes from './routes/documentRoutes';
import announcementRoutes from './routes/announcementRoutes';

const app = express();

app.use(cors());
app.use(express.json());

// Public routes (no auth required)
app.use('/api/auth', authRoutes);
app.use('/api/payment', webhookRoutes);

// Protected routes (require auth)
app.use('/api/users', verifyFirebaseToken, userRoutes);
app.use('/api/daos', verifyFirebaseToken, daoRoutes);
app.use('/api/daos', verifyFirebaseToken, proposalRoutes);
app.use('/api/daos', verifyFirebaseToken, claimRoutes);
app.use('/api/daos', verifyFirebaseToken, memberRoutes);
app.use('/api/daos', verifyFirebaseToken, treasuryRoutes);
app.use('/api/daos', verifyFirebaseToken, taskRoutes);
app.use('/api/daos', verifyFirebaseToken, calendarRoutes);
app.use('/api/daos', verifyFirebaseToken, documentRoutes);
app.use('/api/daos', verifyFirebaseToken, announcementRoutes);
app.use('/api', verifyFirebaseToken, paymentRoutes);

export default app; 