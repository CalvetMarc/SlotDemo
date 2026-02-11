import { Router } from 'express';
import { sql } from '../db.js';
import { signToken } from '../middleware/auth.js';
import { generateInitialGrid } from '../services/spin-service.js';

const router = Router();

router.post('/', async (_req, res) => {
    try {
        // Lazy cleanup: remove stale sessions
        await sql`DELETE FROM sessions WHERE last_seen < now() - interval '5 minutes'`;

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
        console.error('Session creation failed:', err);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

export default router;
