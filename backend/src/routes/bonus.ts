import { Router } from 'express';
import { sql } from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';
import { generateBonusSequence } from '../services/bonus-service.js';
import { generateBuyBonusSpin } from '../services/spin-service.js';
import { getSession } from '../services/session-helpers.js';

const router = Router();

router.post('/start', async (req, res) => {
    const sessionId = (req as AuthRequest).sessionId;

    try {
        const session = await getSession(sessionId);

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        console.log('[bonus/start] sessionId:', sessionId, 'game_phase:', session.game_phase, 'bonus_data:', session.bonus_data);
        if (session.game_phase !== 'bonus') {
            res.status(400).json({ error: 'Not in bonus phase' });
            return;
        }

        const bonusData = session.bonus_data as { wildCount?: number; totalBet?: number } | null;
        if (!bonusData || !bonusData.wildCount || !bonusData.totalBet) {
            res.status(400).json({ error: 'Missing bonus trigger data' });
            return;
        }

        const { sequence, totalBonusWin } = generateBonusSequence(bonusData.wildCount, bonusData.totalBet);

        // Atomic: credit winnings, reset phase, clear bonus data
        const updated = await sql`
            UPDATE sessions
            SET balance = balance + ${totalBonusWin},
                game_phase = 'base',
                bonus_data = NULL,
                last_seen = now()
            WHERE id = ${sessionId}
            RETURNING balance
        `;

        const balance = parseFloat(updated[0].balance);

        res.json({ sequence, totalBonusWin, balance });
    } catch (err) {
        console.error('Bonus start failed:', err);
        res.status(500).json({ error: 'Bonus start failed' });
    }
});

/** Buy bonus: skip base game, go straight to bonus for a fixed price.
 *  Tier 3 (5 wilds) is not offered — 0 skulls makes it deterministic (always 383x for 403x cost). */
const BUY_BONUS_PRICES: readonly [number, number] = [88, 180]; // × totalBet
const BUY_BONUS_WILDS: readonly [number, number] = [3, 4];
const BUY_BONUS_WILD_PAY: readonly [number, number] = [8, 21]; // × totalBet

router.post('/buy', async (req, res) => {
    const sessionId = (req as AuthRequest).sessionId;
    const { betAmount, tier } = req.body;

    if (typeof betAmount !== 'number' || betAmount <= 0) {
        res.status(400).json({ error: 'betAmount must be a positive number' });
        return;
    }
    if (typeof tier !== 'number' || tier < 1 || tier > 2) {
        res.status(400).json({ error: 'tier must be 1 or 2' });
        return;
    }

    const tierIndex = tier - 1;
    const price = Math.round(BUY_BONUS_PRICES[tierIndex] * betAmount * 100) / 100;
    const wildPay = Math.round(BUY_BONUS_WILD_PAY[tierIndex] * betAmount * 100) / 100;
    const netDeduction = Math.round((price - wildPay) * 100) / 100;
    const wildCount = BUY_BONUS_WILDS[tierIndex];

    try {
        const deducted = await sql`
            UPDATE sessions
            SET balance = balance - ${netDeduction}, last_seen = now()
            WHERE id = ${sessionId}
              AND balance >= ${netDeduction}
              AND game_phase = 'base'
            RETURNING balance
        `;

        if (deducted.length === 0) {
            const session = await getSession(sessionId);
            if (!session) {
                res.status(404).json({ error: 'Session not found' });
            } else if (session.game_phase === 'bonus') {
                res.status(400).json({ error: 'Already in bonus' });
            } else {
                res.status(400).json({ error: 'Insufficient balance' });
            }
            return;
        }

        const balance = parseFloat(deducted[0].balance);

        await sql`
            UPDATE sessions
            SET game_phase = 'bonus',
                bonus_data = ${JSON.stringify({ wildCount, totalBet: betAmount })}
            WHERE id = ${sessionId}
        `;

        const spinResult = generateBuyBonusSpin(wildCount, betAmount);

        res.json({
            grid: spinResult.grid,
            balance,
            winAmount: spinResult.winAmount,
            lineWins: spinResult.lineWins,
            wildCount: spinResult.wildCount,
            bonusTriggered: spinResult.bonusTriggered,
            wildPay: spinResult.wildPay,
            tier,
        });
    } catch (err) {
        console.error('Buy bonus failed:', err);
        res.status(500).json({ error: 'Buy bonus failed' });
    }
});

export default router;
