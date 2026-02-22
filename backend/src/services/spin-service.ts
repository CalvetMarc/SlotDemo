import { SYMBOL_IDS, REEL_COUNT, VISIBLE_ROWS } from '../../../shared/types.js';
import type { SymbolId, LineWin } from '../../../shared/types.js';

const WILD: SymbolId = 'Wild_01.png';

/** Virtual reel strips — indices into SYMBOL_IDS. Server-only.
 *  S32: King:3, Queen:4, Wolf:4, J:6, K:5, Q:5, A:4, Wild:1 per reel. */
const REEL_STRIPS: readonly (readonly number[])[] = [
    [3, 7, 5, 0, 3, 4, 6, 0, 1, 4, 6, 2, 5, 1, 5, 0, 3, 2, 3, 4, 3, 2, 6, 1, 5, 1, 5, 6, 4, 2, 3, 4],
    [6, 3, 0, 7, 6, 5, 3, 5, 4, 6, 4, 1, 2, 4, 0, 3, 0, 5, 3, 2, 5, 6, 5, 3, 4, 2, 1, 4, 2, 1, 3, 1],
    [7, 3, 0, 3, 4, 6, 3, 2, 1, 2, 6, 2, 5, 3, 1, 4, 2, 5, 1, 4, 5, 3, 0, 4, 3, 6, 5, 1, 0, 6, 5, 4],
    [4, 3, 2, 6, 5, 2, 6, 5, 2, 5, 0, 3, 4, 3, 0, 1, 4, 6, 1, 0, 7, 1, 2, 1, 3, 4, 5, 3, 5, 3, 4, 6],
    [4, 5, 4, 5, 2, 3, 1, 2, 4, 2, 3, 1, 3, 6, 5, 0, 7, 6, 1, 5, 1, 6, 5, 3, 6, 3, 0, 4, 2, 4, 3, 0],
];

/** 10 payline patterns — each array has 5 row indices (0=top, 1=mid, 2=bottom) */
const PAYLINES: readonly (readonly number[])[] = [
    [1, 1, 1, 1, 1], // 1: straight middle
    [0, 0, 0, 0, 0], // 2: straight top
    [2, 2, 2, 2, 2], // 3: straight bottom
    [0, 1, 2, 1, 0], // 4: V shape
    [2, 1, 0, 1, 2], // 5: inverted V
    [0, 0, 1, 0, 0], // 6: top dip
    [2, 2, 1, 2, 2], // 7: bottom rise
    [1, 2, 2, 2, 1], // 8: U shape
    [1, 0, 0, 0, 1], // 9: inverted U
    [0, 1, 1, 1, 0], // 10: flat dip
];

const PAYLINE_COUNT = PAYLINES.length;

/** Paytable: symbol → [x3, x4, x5] multipliers of totalBet. */
const PAYTABLE: ReadonlyMap<SymbolId, readonly [number, number, number]> = new Map([
    ['Wild_01.png', [2.85,  9.98, 71.27]],
    ['1.png',       [1.71,  6.41, 42.76]],
    ['2.png',       [1.14,  4.28, 28.51]],
    ['3.png',       [0.71,  2.85, 18.53]],
    ['A.png',       [0.43,  1.57, 11.40]],
    ['K.png',       [0.29,  1.14,  7.13]],
    ['Q.png',       [0.23,  0.86,  4.56]],
    ['J.png',       [0.14,  0.57,  2.85]],
]);

/** Wild pays: wildCount → multiplier of totalBet */
const WILD_PAYS: Readonly<Record<number, number>> = { 3: 8, 4: 21, 5: 83 };

/** Expected bonus chest payout per trigger (multipliers of totalBet) */
const BONUS_EXPECTED_CHEST_EV: readonly [number, number, number] = [75, 150, 300];

// ── Types ───────────────────────────────────────────────────

export interface SpinServiceResult {
    grid: SymbolId[][];
    winAmount: number;
    lineWins: LineWin[];
    wildCount: number;
    bonusTriggered: boolean;
    wildPay: number;
}

// ── Win evaluation ──────────────────────────────────────────

function evaluatePayline(
    grid: SymbolId[][],
    payline: readonly number[],
    totalBet: number,
): { symbol: SymbolId; count: number; payout: number } | null {
    const symbols: SymbolId[] = [];
    for (let reel = 0; reel < REEL_COUNT; reel++) {
        symbols.push(grid[reel][payline[reel]]);
    }

    // Find the base symbol (first non-wild)
    let baseSymbol: SymbolId | null = null;
    for (const s of symbols) {
        if (s !== WILD) {
            baseSymbol = s;
            break;
        }
    }

    // All wilds — pays as Wild from paytable
    if (baseSymbol === null) {
        baseSymbol = WILD;
    }

    // Count consecutive matching from left
    let count = 0;
    for (let i = 0; i < REEL_COUNT; i++) {
        if (symbols[i] === baseSymbol || symbols[i] === WILD) {
            count++;
        } else {
            break;
        }
    }

    if (count < 3) return null;

    const pays = PAYTABLE.get(baseSymbol);
    if (!pays) return null;

    const payout = Math.round(pays[count - 3] * totalBet * 100) / 100;
    return { symbol: baseSymbol, count, payout };
}

function countWilds(grid: SymbolId[][]): number {
    let count = 0;
    for (let reel = 0; reel < REEL_COUNT; reel++) {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            if (grid[reel][row] === WILD) {
                count++;
            }
        }
    }
    return count;
}

function evaluateWildPay(wildCount: number, totalBet: number): number {
    const mult = WILD_PAYS[wildCount];
    if (!mult) return 0;
    return Math.round(mult * totalBet * 100) / 100;
}

/** Expected bonus chest payout for RTP calculation (wild pay tracked separately) */
function bonusExpectedPayout(wildCount: number, totalBet: number): number {
    if (wildCount < 3) return 0;
    const tier = Math.min(wildCount - 3, 2);
    return BONUS_EXPECTED_CHEST_EV[tier] * totalBet;
}

export function evaluateWin(
    grid: SymbolId[][],
    totalBet: number,
): { lineWins: LineWin[]; wildCount: number; bonusTriggered: boolean; totalWin: number; wildPay: number } {
    const lineWins: LineWin[] = [];

    // Evaluate paylines
    for (let i = 0; i < PAYLINE_COUNT; i++) {
        const result = evaluatePayline(grid, PAYLINES[i], totalBet);
        if (result) {
            lineWins.push({
                lineIndex: i,
                symbol: result.symbol,
                count: result.count,
                payout: result.payout,
            });
        }
    }

    // Evaluate wilds (bonus trigger + wild pay)
    const wildCount = countWilds(grid);
    const bonusTriggered = wildCount >= 3;
    const wildPay = evaluateWildPay(wildCount, totalBet);

    const lineTotalWin = lineWins.reduce((sum, lw) => sum + lw.payout, 0);
    const totalWin = lineTotalWin + wildPay;

    return { lineWins, wildCount, bonusTriggered, totalWin, wildPay };
}

// ── Spin generation ─────────────────────────────────────────

export function generateSpin(totalBet: number): SpinServiceResult {
    const grid: SymbolId[][] = [];

    for (let r = 0; r < REEL_COUNT; r++) {
        const strip = REEL_STRIPS[r];
        const stopIndex = Math.floor(Math.random() * strip.length);
        const column: SymbolId[] = [];

        for (let row = 0; row < VISIBLE_ROWS; row++) {
            const idx = (stopIndex + row) % strip.length;
            column.push(SYMBOL_IDS[strip[idx]]);
        }
        grid.push(column);
    }

    const { lineWins, wildCount, bonusTriggered, totalWin, wildPay } = evaluateWin(grid, totalBet);

    return { grid, winAmount: totalWin, lineWins, wildCount, bonusTriggered, wildPay };
}

/**
 * Fixed initial grid — no wild, no winning payline.
 * Every payline has different symbols on reels 1 & 2, so no 3-of-a-kind.
 */
const INITIAL_GRID: SymbolId[][] = [
    ['K.png', '1.png', 'Q.png'],    // reel 1
    ['3.png', 'J.png', 'A.png'],    // reel 2
    ['A.png', 'K.png', '2.png'],    // reel 3
    ['J.png', 'Q.png', '3.png'],    // reel 4
    ['2.png', 'A.png', 'K.png'],    // reel 5
];

export function generateInitialGrid(): SymbolId[][] {
    return INITIAL_GRID;
}

