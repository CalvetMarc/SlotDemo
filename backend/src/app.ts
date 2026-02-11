import express from 'express';
import cors from 'cors';
import sessionRouter from './routes/session.js';
import spinRouter from './routes/spin.js';
import heartbeatRouter from './routes/heartbeat.js';
import bonusRouter from './routes/bonus.js';

const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

app.use(cors({
    origin: (origin, callback) => {
        // Allow configured origin (production) and any local dev origin
        if (!origin || origin === CORS_ORIGIN || /^http:\/\/(localhost|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS not allowed'));
        }
    },
}));
app.use(express.json());

app.use('/api/session', sessionRouter);
app.use('/api/spin', spinRouter);
app.use('/api/heartbeat', heartbeatRouter);
app.use('/api/bonus', bonusRouter);

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

export default app;
