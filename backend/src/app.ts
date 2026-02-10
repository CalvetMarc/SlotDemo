import express from 'express';
import cors from 'cors';
import sessionRouter from './routes/session.js';
import spinRouter from './routes/spin.js';
import heartbeatRouter from './routes/heartbeat.js';

const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.use('/api/session', sessionRouter);
app.use('/api/spin', spinRouter);
app.use('/api/heartbeat', heartbeatRouter);

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

export default app;
