import type { SymbolId } from '@shared/types';
import { REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
import type { SpinResultWithWins } from './spin-result-provider';
import { PAYLINES } from './slot-config';

const WILD_PAYS: Readonly<Record<number, number>> = { 3: 8, 4: 21, 5: 83 };

/** Paytable: symbol → [x3, x4, x5] multipliers of totalBet. */
const PAYTABLE: ReadonlyMap<SymbolId, readonly [number, number, number]> = new Map([
    ['1.png',       [1.71,  6.41, 42.76]],
    ['2.png',       [1.14,  4.28, 28.51]],
    ['3.png',       [0.71,  2.85, 18.53]],
    ['A.png',       [0.43,  1.57, 11.40]],
    ['K.png',       [0.29,  1.14,  7.13]],
    ['Q.png',       [0.23,  0.86,  4.56]],
    ['J.png',       [0.14,  0.57,  2.85]],
]);

function calcPayout(symbol: SymbolId, count: number, totalBet: number): number {
    const pays = PAYTABLE.get(symbol);
    if (!pays || count < 3) return 0;
    return Math.round(pays[count - 3] * totalBet * 100) / 100;
}

function calcWildPay(wildCount: number, totalBet: number): number {
    const mult = WILD_PAYS[wildCount];
    if (!mult) return 0;
    return Math.round(mult * totalBet * 100) / 100;
}

export function countWilds(grid: SymbolId[][]): number {
    let count = 0;
    for (const reel of grid) {
        for (const id of reel) {
            if (id === 'Wild_01.png') count++;
        }
    }
    return count;
}

export function createDebugLineWin(
    lineIndex: number,
    symbol: SymbolId,
    betAmount: number,
): SpinResultWithWins {
    const grid: SymbolId[][] = [
        ['J.png', 'Q.png', 'K.png'],
        ['K.png', 'A.png', 'J.png'],
        ['Q.png', 'K.png', 'A.png'],
        ['A.png', 'J.png', 'Q.png'],
        ['K.png', 'Q.png', 'J.png'],
    ];

    const payline = PAYLINES[lineIndex];
    for (let reel = 0; reel < REEL_COUNT; reel++) {
        grid[reel][payline[reel]] = symbol;
    }

    const payout = calcPayout(symbol, 5, betAmount);
    const wildCount = countWilds(grid);
    return {
        grid,
        winAmount: payout,
        lineWins: [{ lineIndex, symbol, count: 5, payout }],
        wildCount,
        bonusTriggered: wildCount >= 3,
        wildPay: 0,
    };
}

export function createDebugMultiLineWin(betAmount: number): SpinResultWithWins {
    // 3 winning paylines with a wild in the center (reel 2, row 1)
    // Payline 1 [0,0,0,0,0] top:    1, 1, 1, J, 3 → 3 of 1 (king)
    // Payline 2 [1,1,1,1,1] middle:  2, 2, Wild, 2, 2 → 5 of 2 (queen)
    // Payline 3 [2,2,2,2,2] bottom:  K, K, K, K, Q → 4 of K
    const grid: SymbolId[][] = [
        ['1.png', '2.png', 'K.png'],
        ['1.png', '2.png', 'K.png'],
        ['1.png', 'Wild_01.png', 'K.png'],
        ['J.png', '2.png', 'K.png'],
        ['3.png', '2.png', 'Q.png'],
    ];

    const pay1 = calcPayout('1.png', 3, betAmount);
    const pay2 = calcPayout('2.png', 5, betAmount);
    const payK = calcPayout('K.png', 4, betAmount);
    const wildCount = countWilds(grid);
    return {
        grid,
        winAmount: pay1 + pay2 + payK,
        lineWins: [
            { lineIndex: 0, symbol: '1.png', count: 3, payout: pay1 },
            { lineIndex: 1, symbol: '2.png', count: 5, payout: pay2 },
            { lineIndex: 2, symbol: 'K.png', count: 4, payout: payK },
        ],
        wildCount,
        bonusTriggered: false,
        wildPay: 0,
    };
}

export function createDebugTensionTest(): SpinResultWithWins {
    const grid: SymbolId[][] = [
        ['Wild_01.png', 'Q.png', 'K.png'],
        ['K.png', 'A.png', 'J.png'],
        ['Wild_01.png', 'K.png', 'A.png'],
        ['A.png', 'J.png', 'Q.png'],
        ['K.png', 'Q.png', 'J.png'],
    ];
    const wildCount = countWilds(grid);
    return { grid, winAmount: 0, lineWins: [], wildCount, bonusTriggered: wildCount >= 3, wildPay: 0 };
}

export function createDebugWildLineWin(betAmount: number): SpinResultWithWins {
    const grid: SymbolId[][] = [
        ['Wild_01.png', '1.png', 'J.png'],
        ['Q.png', '1.png', 'Wild_01.png'],
        ['Wild_01.png', '1.png', 'K.png'],
        ['A.png', '1.png', 'Q.png'],
        ['K.png', '1.png', 'J.png'],
    ];

    const linePayout = calcPayout('1.png', 5, betAmount);
    const line10Payout = calcPayout('1.png', 4, betAmount);
    const wildCount = countWilds(grid);
    const wildPay = calcWildPay(wildCount, betAmount);
    return {
        grid,
        winAmount: linePayout + line10Payout + wildPay,
        lineWins: [
            { lineIndex: 1, symbol: '1.png', count: 5, payout: linePayout },
            { lineIndex: 9, symbol: '1.png', count: 4, payout: line10Payout },
        ],
        wildCount,
        bonusTriggered: wildCount >= 3,
        wildPay,
    };
}

interface DebugKeyDeps {
    getIsSpinning: () => boolean;
    getBetAmount: () => number;
    triggerSpin: (forced: SpinResultWithWins) => void;
}

export function createDebugKeyHandler(deps: DebugKeyDeps): { attach: () => () => void } {
    return {
        attach() {
            const handler = (event: KeyboardEvent): void => {
                if (event.repeat || deps.getIsSpinning()) return;

                const map: Partial<Record<string, { type: 'lineWin'; lineIndex: number; symbol: SymbolId } | { type: 'multiLine' } | { type: 'wildLine' } | { type: 'tensionTest' }>> = {
                    Digit1: { type: 'lineWin', lineIndex: 0, symbol: '1.png' },
                    Digit2: { type: 'lineWin', lineIndex: 1, symbol: '2.png' },
                    Digit3: { type: 'lineWin', lineIndex: 2, symbol: '3.png' },
                    Digit4: { type: 'lineWin', lineIndex: 3, symbol: 'J.png' },
                    Digit5: { type: 'lineWin', lineIndex: 4, symbol: 'Q.png' },
                    Digit6: { type: 'lineWin', lineIndex: 5, symbol: 'K.png' },
                    Digit7: { type: 'lineWin', lineIndex: 6, symbol: 'A.png' },
                    Digit8: { type: 'tensionTest' },
                    Digit9: { type: 'multiLine' },
                    Digit0: { type: 'wildLine' },
                };
                const debugPreset = map[event.code];
                if (!debugPreset) return;

                event.preventDefault();
                const bet = deps.getBetAmount();
                let forced: SpinResultWithWins;

                if (debugPreset.type === 'wildLine') {
                    forced = createDebugWildLineWin(bet);
                } else if (debugPreset.type === 'tensionTest') {
                    forced = createDebugTensionTest();
                } else if (debugPreset.type === 'multiLine') {
                    forced = createDebugMultiLineWin(bet);
                } else {
                    forced = createDebugLineWin(debugPreset.lineIndex, debugPreset.symbol, bet);
                }

                deps.triggerSpin(forced);
            };

            window.addEventListener('keydown', handler);
            return () => window.removeEventListener('keydown', handler);
        },
    };
}
