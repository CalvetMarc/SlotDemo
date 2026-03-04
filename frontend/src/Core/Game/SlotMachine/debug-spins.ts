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

export function createDebugBonusTrigger(betAmount: number): SpinResultWithWins {
    const grid: SymbolId[][] = [
        ['K.png', '1.png', 'Q.png'],
        ['3.png', 'J.png', 'A.png'],
        ['A.png', 'K.png', '2.png'],
        ['J.png', 'Q.png', '3.png'],
        ['2.png', 'A.png', 'K.png'],
    ];

    grid[0][0] = 'Wild_01.png';
    grid[2][1] = 'Wild_01.png';
    grid[4][2] = 'Wild_01.png';

    const wildCount = countWilds(grid);
    const wildPay = calcWildPay(wildCount, betAmount);
    return {
        grid,
        winAmount: wildPay,
        lineWins: [],
        wildCount,
        bonusTriggered: wildCount >= 3,
        wildPay,
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
    const wildCount = countWilds(grid);
    const wildPay = calcWildPay(wildCount, betAmount);
    return {
        grid,
        winAmount: linePayout + wildPay,
        lineWins: [{ lineIndex: 0, symbol: '1.png', count: 5, payout: linePayout }],
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

                const map: Partial<Record<string, { type: 'lineWin'; lineIndex: number; symbol: SymbolId } | { type: 'bonus' } | { type: 'wildLine' } | { type: 'tensionTest' }>> = {
                    Digit1: { type: 'lineWin', lineIndex: 0, symbol: '1.png' },
                    Digit2: { type: 'lineWin', lineIndex: 1, symbol: '2.png' },
                    Digit3: { type: 'lineWin', lineIndex: 2, symbol: '3.png' },
                    Digit4: { type: 'lineWin', lineIndex: 3, symbol: 'J.png' },
                    Digit5: { type: 'lineWin', lineIndex: 4, symbol: 'Q.png' },
                    Digit6: { type: 'lineWin', lineIndex: 5, symbol: 'K.png' },
                    Digit7: { type: 'lineWin', lineIndex: 6, symbol: 'A.png' },
                    Digit8: { type: 'tensionTest' },
                    Digit9: { type: 'bonus' },
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
                } else if (debugPreset.type === 'bonus') {
                    forced = createDebugBonusTrigger(bet);
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
