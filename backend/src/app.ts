import express from 'express';
import cors from 'cors';
import startRouter from './routes/start.js';
import spinRouter from './routes/spin.js';
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

app.use('/api/start', startRouter);
app.use('/api/spin', spinRouter);
app.use('/api/bonus', bonusRouter);

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

export default app;
