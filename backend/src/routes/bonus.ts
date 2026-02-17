import { Router } from 'express';
import { sql } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { generateBonusChests, pickChest, BonusState } from '../services/bonus-service.js';

const router = Router();

router.post('/start', authMiddleware, async (req, res) => {
    const sessionId = (req as AuthRequest).sessionId;

    try {
        const rows = await sql`
            SELECT game_phase, bonus_data, balance FROM sessions WHERE id = ${sessionId}
        `;

        if (rows.length === 0) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        if (rows[0].game_phase !== 'bonus') {
            res.status(400).json({ error: 'Not in bonus phase' });
            return;
        }

        const bonusData = rows[0].bonus_data;
        if (!bonusData || !bonusData.wildCount || !bonusData.totalBet) {
            res.status(400).json({ error: 'Missing bonus trigger data' });
            return;
        }

        const state = generateBonusChests(bonusData.wildCount, bonusData.totalBet);

        await sql`
            UPDATE sessions SET bonus_data = ${JSON.stringify(state)}, last_seen = now()
            WHERE id = ${sessionId}
        `;

        res.json({ chestCount: 5, tier: state.tier });
    } catch (err) {
        console.error('Bonus start failed:', err);
        res.status(500).json({ error: 'Bonus start failed' });
    }
});

router.post('/pick', authMiddleware, async (req, res) => {
    const sessionId = (req as AuthRequest).sessionId;
    const { chestIndex } = req.body;

    if (typeof chestIndex !== 'number' || chestIndex < 0 || chestIndex > 4) {
        res.status(400).json({ error: 'chestIndex must be 0-4' });
        return;
    }

    try {
        const rows = await sql`
            SELECT game_phase, bonus_data, balance FROM sessions WHERE id = ${sessionId}
        `;

        if (rows.length === 0) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        if (rows[0].game_phase !== 'bonus') {
            res.status(400).json({ error: 'Not in bonus phase' });
            return;
        }

        const state: BonusState = rows[0].bonus_data;
        if (!state || !state.chests) {
            res.status(400).json({ error: 'No active bonus' });
            return;
        }

        if (state.picked[chestIndex]) {
            res.status(400).json({ error: 'Chest already picked' });
            return;
        }

        const result = pickChest(state, chestIndex);

        if (result.isGameOver) {
            // Bonus over: add winnings to balance, return to base phase
            const newBalance = parseFloat(rows[0].balance) + result.totalBonusWin;
            await sql`
                UPDATE sessions
                SET balance = ${newBalance}, game_phase = 'base', bonus_data = NULL, last_seen = now()
                WHERE id = ${sessionId}
            `;
            res.json({ ...result, balance: newBalance });
        } else {
            // Save updated state
            await sql`
                UPDATE sessions SET bonus_data = ${JSON.stringify(state)}, last_seen = now()
                WHERE id = ${sessionId}
            `;
            res.json(result);
        }
    } catch (err) {
        console.error('Bonus pick failed:', err);
        res.status(500).json({ error: 'Bonus pick failed' });
    }
});

export default router;
