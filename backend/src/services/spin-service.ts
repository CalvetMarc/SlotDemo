import type { SymbolId } from '../../../shared/types.js';

const SYMBOL_IDS: readonly SymbolId[] = [
    '1.png', '2.png', '3.png',
    'J.png', 'K.png', 'Q.png', 'A.png',
    'Scatter_01.png', 'Wild_01.png',
];

const REEL_COUNT = 5;
const VISIBLE_ROWS = 3;

/** Virtual reel strips — indices into SYMBOL_IDS. Server-only. */
const REEL_STRIPS: readonly (readonly number[])[] = [
    [0, 3, 1, 4, 2, 5, 0, 6, 3, 1, 5, 2, 4, 6, 0, 3, 1, 7, 5, 2],
    [1, 4, 0, 5, 3, 6, 2, 0, 4, 1, 3, 5, 6, 2, 0, 4, 8, 1, 3, 5],
    [2, 5, 3, 0, 6, 1, 4, 2, 5, 3, 0, 6, 1, 4, 7, 2, 5, 3, 0, 6],
    [3, 0, 4, 1, 5, 2, 6, 3, 0, 4, 1, 5, 2, 6, 3, 0, 8, 4, 1, 5],
    [4, 1, 5, 2, 0, 3, 6, 4, 1, 5, 2, 0, 3, 6, 4, 7, 1, 5, 2, 0],
];

export interface SpinServiceResult {
    grid: SymbolId[][];
    winAmount: number;
}

export function generateSpin(): SpinServiceResult {
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

    // TODO: implement pay table evaluation
    const winAmount = 0;

    return { grid, winAmount };
}
