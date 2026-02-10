import { Router, Request } from 'express';
import { sql } from '../db.js';
import { authMiddleware, signToken } from '../middleware/auth.js';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res) => {
    const sessionId = (req as Request & { sessionId: string }).sessionId;

    try {
        const rows = await sql`
            UPDATE sessions SET last_seen = now()
            WHERE id = ${sessionId}
            RETURNING id
        `;

        if (rows.length === 0) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        // Issue fresh JWT
        const token = signToken(sessionId);
        res.json({ token });
    } catch (err) {
        console.error('Heartbeat failed:', err);
        res.status(500).json({ error: 'Heartbeat failed' });
    }
});

export default router;
