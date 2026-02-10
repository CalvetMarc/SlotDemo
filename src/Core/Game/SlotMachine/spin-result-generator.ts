import { REEL_COUNT, VISIBLE_ROWS, REEL_STRIPS, SYMBOL_IDS, SymbolId } from './slot-config';

/** Final grid after a spin: grid[reelIndex][rowIndex] = symbolId texture name. */
export interface SpinResult {
    grid: SymbolId[][];
}

/** Seam for future server integration. */
export interface ISpinResultProvider {
    generateResult(): SpinResult;
}

/**
 * Local random result generator.
 * Picks a random stop position on each reel strip and returns
 * the visible window of VISIBLE_ROWS symbols.
 */
export class LocalSpinResultGenerator implements ISpinResultProvider {
    generateResult(): SpinResult {
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

        return { grid };
    }
}
