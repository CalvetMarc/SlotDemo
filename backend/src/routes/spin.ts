import { Router } from 'express';
import { sql } from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';
import { generateSpin } from '../services/spin-service.js';

const router = Router();

router.post('/', async (req, res) => {
    const sessionId = (req as AuthRequest).sessionId;
    const { betAmount } = req.body;

    if (typeof betAmount !== 'number' || betAmount <= 0) {
        res.status(400).json({ error: 'betAmount must be a positive number' });
        return;
    }

    try {
        // Atomically deduct bet — prevents race conditions on concurrent spins
        const deducted = await sql`
            UPDATE sessions
            SET balance = balance - ${betAmount}, last_seen = now()
            WHERE id = ${sessionId}
              AND balance >= ${betAmount}
              AND game_phase = 'base'
            RETURNING balance
        `;

        if (deducted.length === 0) {
            // Distinguish between not found, insufficient balance, or wrong phase
            const rows = await sql`
                SELECT balance, game_phase FROM sessions WHERE id = ${sessionId}
            `;
            if (rows.length === 0) {
                res.status(404).json({ error: 'Session not found' });
            } else if (rows[0].game_phase === 'bonus') {
                res.status(400).json({ error: 'Cannot spin during bonus' });
            } else {
                res.status(400).json({ error: 'Insufficient balance' });
            }
            return;
        }

        const balanceAfterBet = parseFloat(deducted[0].balance);

        const { grid, winAmount, lineWins, wildCount, bonusTriggered, wildPay } = generateSpin(betAmount);
        const newBalance = balanceAfterBet + winAmount;

        if (bonusTriggered) {
            await sql`
                UPDATE sessions
                SET balance = ${newBalance}, game_phase = 'bonus',
                    bonus_data = ${JSON.stringify({ wildCount, totalBet: betAmount })}
                WHERE id = ${sessionId}
            `;
        } else if (winAmount > 0) {
            await sql`
                UPDATE sessions SET balance = ${newBalance}
                WHERE id = ${sessionId}
            `;
        }

        res.json({ grid, balance: newBalance, winAmount, lineWins, wildCount, bonusTriggered, wildPay });
    } catch (err) {
        console.error('Spin failed:', err);
        res.status(500).json({ error: 'Spin request failed' });
    }
});

export default router;
