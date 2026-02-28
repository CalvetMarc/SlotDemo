import express from 'express';
import cors from 'cors';
import startRouter from './routes/start.js';
import spinRouter from './routes/spin.js';
import bonusRouter from './routes/bonus.js';
import { authMiddleware } from './middleware/auth.js';
import { createRateLimiter, ipKey, sessionKey } from './middleware/rate-limiter.js';

const startIpLimiter = createRateLimiter({ maxRequests: 3, windowMs: 10_000, keyExtractor: ipKey });
const spinSessionLimiter = createRateLimiter({ maxRequests: 5, windowMs: 1_000, keyExtractor: sessionKey });
const bonusSessionLimiter = createRateLimiter({ maxRequests: 2, windowMs: 1_000, keyExtractor: sessionKey });

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

app.use('/api/start', startIpLimiter, startRouter);
app.use('/api/spin', authMiddleware, spinSessionLimiter, spinRouter);
app.use('/api/bonus', authMiddleware, bonusSessionLimiter, bonusRouter);

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

export default app;
