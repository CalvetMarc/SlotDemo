import { Router } from 'express';
import { sql } from '../db.js';
import { signToken, verifyTokenSafe } from '../middleware/auth.js';
import { generateInitialGrid } from '../services/spin-service.js';

const router = Router();

router.post('/', async (req, res) => {
    try {
        const oldToken: unknown = req.body?.token;

        // Clean up previous session if caller sent a valid token
        if (typeof oldToken === 'string' && oldToken) {
            const oldSessionId = verifyTokenSafe(oldToken);
            if (oldSessionId) {
                await sql`DELETE FROM sessions WHERE id = ${oldSessionId}`;
            }
        }

        // Lazy cleanup: remove stale sessions
        await sql`DELETE FROM sessions WHERE last_seen < now() - interval '1 hour'`;

        // Create new session
        const rows = await sql`
            INSERT INTO sessions DEFAULT VALUES
            RETURNING id, balance, game_phase
        `;

        const session = rows[0];
        const token = signToken(session.id);

        res.json({
            token,
            balance: parseFloat(session.balance),
            gamePhase: session.game_phase,
            initialGrid: generateInitialGrid(),
        });
    } catch (err) {
        console.error('Start failed:', err);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

export default router;
