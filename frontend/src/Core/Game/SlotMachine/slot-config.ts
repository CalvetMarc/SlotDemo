// Re-export shared types so existing imports keep working
export { SYMBOL_IDS, REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
export type { SymbolId } from '@shared/types';

// ── Grid (derived, frontend-only) ───────────────────────────────
import { REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
import type { LineWin } from '@shared/types';

export const SYMBOL_SIZE = 320;
export const CELL_PAD = 8;
export const CELL_SIZE = SYMBOL_SIZE + CELL_PAD;  // 328
export const GRID_WIDTH = CELL_SIZE * REEL_COUNT;  // 1640
export const GRID_HEIGHT = CELL_SIZE * VISIBLE_ROWS;  // 984

// ── Paylines (mirrors backend spin-service.ts) ──────────────────
export const PAYLINES: readonly (readonly number[])[] = [
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

/** Returns a set of "reel,row" keys for all winning cell positions. */
export function getWinPositions(lineWins: LineWin[]): Set<string> {
    const positions = new Set<string>();
    for (const lw of lineWins) {
        const payline = PAYLINES[lw.lineIndex];
        for (let reel = 0; reel < lw.count; reel++) {
            positions.add(`${reel},${payline[reel]}`);
        }
    }
    return positions;
}

/** Returns a set of "reel,row" keys for ALL cells in winning payline patterns (all 5 reels). */
export function getFullPaylinePositions(lineWins: LineWin[]): Set<string> {
    const positions = new Set<string>();
    for (const lw of lineWins) {
        const payline = PAYLINES[lw.lineIndex];
        for (let reel = 0; reel < REEL_COUNT; reel++) {
            positions.add(`${reel},${payline[reel]}`);
        }
    }
    return positions;
}

// ── Animation ────────────────────────────────────────────────────
export const SPIN_SPEED = 85;           // px per frame at full speed
export const SPIN_MIN_DURATION = 800;   // ms before first reel can stop
export const REEL_START_INTERVAL = 100; // ms between each reel starting
export const REEL_STOP_INTERVAL = 450;  // ms between each reel stopping
export const ANTICIPATION_PX = 110;     // pull-up distance before spin
export const ANTICIPATION_MS = 350;     // pull-up duration
export const OVERSHOOT_PX = 50;         // bounce past target
export const BOUNCE_DURATION = 200;     // ms to settle back
