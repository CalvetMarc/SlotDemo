import type { SymbolId } from '@shared/types';
import { REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
import type { SpinResultWithWins } from './spin-result-provider';
import { PAYLINES } from './slot-config';

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

    const payout = betAmount * 10;
    const wildCount = countWilds(grid);
    return {
        grid,
        winAmount: payout,
        lineWins: [{ lineIndex, symbol, count: 5, payout }],
        wildCount,
        bonusTriggered: wildCount >= 3,
    };
}

export function createDebugBonusTrigger(): SpinResultWithWins {
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
    return {
        grid,
        winAmount: 0,
        lineWins: [],
        wildCount,
        bonusTriggered: wildCount >= 3,
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
    return { grid, winAmount: 0, lineWins: [], wildCount, bonusTriggered: wildCount >= 3 };
}

export function createDebugWildLineWin(betAmount: number): SpinResultWithWins {
    const grid: SymbolId[][] = [
        ['Wild_01.png', '1.png', 'J.png'],
        ['Q.png', '1.png', 'Wild_01.png'],
        ['Wild_01.png', '1.png', 'K.png'],
        ['A.png', '1.png', 'Q.png'],
        ['K.png', '1.png', 'J.png'],
    ];

    const payout = betAmount * 10;
    const wildCount = countWilds(grid);
    return {
        grid,
        winAmount: payout,
        lineWins: [{ lineIndex: 0, symbol: '1.png', count: 5, payout }],
        wildCount,
        bonusTriggered: wildCount >= 3,
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
                    forced = createDebugBonusTrigger();
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
