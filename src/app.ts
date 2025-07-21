import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import paymentRoutes from './routes/paymentRoutes';
import webhookRoutes from './routes/webhookRoutes';
import userRoutes from './routes/userRoutes';
import daoRoutes from './routes/daoRoutes';
import proposalRoutes from './routes/proposalRoutes';
import claimRoutes from './routes/claimRoutes';
import memberRoutes from './routes/memberRoutes';
import treasuryRoutes from './routes/treasuryRoutes';

const app = express();

app.use(cors());
app.use(express.json());

// Mount routers
app.use('/api/payment', webhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/daos', daoRoutes);
app.use('/api/daos', proposalRoutes);
app.use('/api/daos', claimRoutes);
app.use('/api/daos', memberRoutes);
app.use('/api/daos', treasuryRoutes);
app.use('/api', paymentRoutes);
// TODO: Add more routers as needed

export default app; 