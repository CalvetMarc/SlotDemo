import { Router } from 'express';
import { sql } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { generateSpin } from '../services/spin-service.js';

const router = Router();

router.post('/', authMiddleware, async (req, res) => {
    const sessionId = (req as AuthRequest).sessionId;
    const { betAmount } = req.body;

    if (typeof betAmount !== 'number' || betAmount <= 0) {
        res.status(400).json({ error: 'betAmount must be a positive number' });
        return;
    }

    try {
        // Fetch session and validate balance
        const rows = await sql`
            SELECT balance, game_phase FROM sessions WHERE id = ${sessionId}
        `;

        if (rows.length === 0) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        const currentBalance = parseFloat(rows[0].balance);
        if (currentBalance < betAmount) {
            res.status(400).json({ error: 'Insufficient balance' });
            return;
        }

        // Block spins during bonus phase
        if (rows[0].game_phase === 'bonus') {
            res.status(400).json({ error: 'Cannot spin during bonus' });
            return;
        }

        // Generate spin result (betPerLine = betAmount / 20 paylines)
        const betPerLine = betAmount / 20;
        const { grid, winAmount, lineWins, wildCount, bonusTriggered } = generateSpin(betPerLine);
        const newBalance = currentBalance - betAmount + winAmount;

        if (bonusTriggered) {
            // Enter bonus phase — store wild info for /api/bonus/start
            await sql`
                UPDATE sessions
                SET balance = ${newBalance}, game_phase = 'bonus',
                    bonus_data = ${JSON.stringify({ wildCount, totalBet: betAmount })},
                    last_seen = now()
                WHERE id = ${sessionId}
            `;
        } else {
            await sql`
                UPDATE sessions SET balance = ${newBalance}, last_seen = now()
                WHERE id = ${sessionId}
            `;
        }

        res.json({ grid, balance: newBalance, winAmount, lineWins, wildCount, bonusTriggered });
    } catch (err) {
        console.error('Spin failed:', err);
        res.status(500).json({ error: 'Spin request failed' });
    }
});

export default router;
