const SYMBOL_IDS = [
    '1.png', '2.png', '3.png',
    'J.png', 'K.png', 'Q.png', 'A.png',
    'Scatter_01.png', 'Wild_01.png',
] as const;

type SymbolId = (typeof SYMBOL_IDS)[number];

const SCATTER: SymbolId = 'Scatter_01.png';
const WILD: SymbolId = 'Wild_01.png';

const REEL_COUNT = 5;
const VISIBLE_ROWS = 3;

/** Virtual reel strips — indices into SYMBOL_IDS. Server-only.
 *  Scatter (7) on all 5 reels. Wild (8) on reels 2,4. */
const REEL_STRIPS: readonly (readonly number[])[] = [
    [0, 3, 1, 4, 2, 5, 0, 6, 3, 1, 5, 2, 4, 6, 0, 3, 1, 7, 5, 2],
    [1, 4, 0, 5, 3, 6, 2, 0, 4, 1, 3, 5, 6, 2, 0, 4, 8, 1, 3, 7],
    [2, 5, 3, 0, 6, 1, 4, 2, 5, 3, 0, 6, 1, 4, 7, 2, 5, 3, 0, 6],
    [3, 0, 4, 1, 5, 2, 6, 3, 0, 4, 1, 5, 2, 6, 3, 0, 8, 4, 1, 7],
    [4, 1, 5, 2, 0, 3, 6, 4, 1, 5, 2, 0, 3, 6, 4, 7, 1, 5, 2, 0],
];

/** 20 payline patterns — each array has 5 row indices (0=top, 1=mid, 2=bottom) */
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
    [2, 1, 1, 1, 2], // 11: flat rise
    [1, 0, 1, 0, 1], // 12: zigzag up
    [1, 2, 1, 2, 1], // 13: zigzag down
    [0, 1, 0, 1, 0], // 14: small zigzag top
    [2, 1, 2, 1, 2], // 15: small zigzag bottom
    [0, 0, 1, 2, 2], // 16: descending
    [2, 2, 1, 0, 0], // 17: ascending
    [1, 0, 0, 1, 2], // 18: step down
    [1, 2, 2, 1, 0], // 19: step up
    [0, 1, 2, 2, 1], // 20: slide down
];

const PAYLINE_COUNT = PAYLINES.length;

/** Paytable: symbol → [x3, x4, x5] multipliers of betPerLine */
const PAYTABLE: ReadonlyMap<SymbolId, readonly [number, number, number]> = new Map([
    ['1.png', [19, 67, 336]],
    ['2.png', [17, 50, 168]],
    ['3.png', [13, 34, 101]],
    ['A.png', [7, 17, 67]],
    ['K.png', [5, 13, 50]],
    ['Q.png', [4, 10, 34]],
    ['J.png', [3, 7, 27]],
]);

/**
 * Bonus expected payout per trigger (multipliers of totalBet).
 * Based on pick-me mechanic: 5 chests, pick until empty.
 *   3 scatters: 2 empty, 3 prizes → E[picks]=1.0
 *   4 scatters: 1 empty, 4 prizes → E[picks]=2.0
 *   5 scatters: 0 empty, 5 prizes → E[picks]=5.0
 * Average prize per pick = BONUS_AVG_PRIZE_PER_PICK × totalBet
 */
const BONUS_AVG_PRIZE_PER_PICK = 20;
const BONUS_EXPECTED_PICKS: readonly [number, number, number] = [1.0, 2.0, 5.0];

// ── Types ───────────────────────────────────────────────────

export interface LineWin {
    lineIndex: number;
    symbol: SymbolId;
    count: number;
    payout: number;
}

export interface SpinServiceResult {
    grid: SymbolId[][];
    winAmount: number;
    lineWins: LineWin[];
    scatterCount: number;
    bonusTriggered: boolean;
}

// ── Win evaluation ──────────────────────────────────────────

function evaluatePayline(
    grid: SymbolId[][],
    payline: readonly number[],
    betPerLine: number,
): { symbol: SymbolId; count: number; payout: number } | null {
    const symbols: SymbolId[] = [];
    for (let reel = 0; reel < REEL_COUNT; reel++) {
        symbols.push(grid[reel][payline[reel]]);
    }

    // Find the base symbol (first non-wild)
    let baseSymbol: SymbolId | null = null;
    for (const s of symbols) {
        if (s !== WILD && s !== SCATTER) {
            baseSymbol = s;
            break;
        }
    }

    // All wilds — treat as highest paying symbol
    if (baseSymbol === null) {
        baseSymbol = '1.png';
    }

    // If first symbol is scatter (not wild), no payline win
    if (symbols[0] === SCATTER) return null;

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

    const payout = pays[count - 3] * betPerLine;
    return { symbol: baseSymbol, count, payout };
}

function countScatters(grid: SymbolId[][]): number {
    let count = 0;
    for (let reel = 0; reel < REEL_COUNT; reel++) {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            if (grid[reel][row] === SCATTER) {
                count++;
            }
        }
    }
    return count;
}

/** Expected bonus payout for RTP calculation purposes */
export function bonusExpectedPayout(scatterCount: number, totalBet: number): number {
    if (scatterCount < 3) return 0;
    const tier = Math.min(scatterCount - 3, 2);
    return BONUS_EXPECTED_PICKS[tier] * BONUS_AVG_PRIZE_PER_PICK * totalBet;
}

export function evaluateWin(
    grid: SymbolId[][],
    betPerLine: number,
): { lineWins: LineWin[]; scatterCount: number; bonusTriggered: boolean; totalWin: number; bonusExpected: number } {
    const totalBet = betPerLine * PAYLINE_COUNT;
    const lineWins: LineWin[] = [];

    // Evaluate paylines
    for (let i = 0; i < PAYLINE_COUNT; i++) {
        const result = evaluatePayline(grid, PAYLINES[i], betPerLine);
        if (result) {
            lineWins.push({
                lineIndex: i,
                symbol: result.symbol,
                count: result.count,
                payout: result.payout,
            });
        }
    }

    // Evaluate scatter
    const scatterCount = countScatters(grid);
    const bonusTriggered = scatterCount >= 3;

    // Line wins are immediate; bonus payout comes later from pick-me game
    const lineTotalWin = lineWins.reduce((sum, lw) => sum + lw.payout, 0);
    const bonusExpected = bonusExpectedPayout(scatterCount, totalBet);

    return { lineWins, scatterCount, bonusTriggered, totalWin: lineTotalWin, bonusExpected };
}

// ── Spin generation ─────────────────────────────────────────

export function generateSpin(betPerLine: number): SpinServiceResult {
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

    const { lineWins, scatterCount, bonusTriggered, totalWin } = evaluateWin(grid, betPerLine);

    return { grid, winAmount: totalWin, lineWins, scatterCount, bonusTriggered };
}

/**
 * Fixed initial grid — no scatter, no wild, no winning payline.
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

// ── Exports for RTP calculator ──────────────────────────────

export { REEL_STRIPS, REEL_COUNT, VISIBLE_ROWS, SYMBOL_IDS, PAYLINE_COUNT, PAYLINES, BONUS_AVG_PRIZE_PER_PICK, BONUS_EXPECTED_PICKS };
export type { SymbolId };
