// ── Grid ──────────────────────────────────────────────────────────
export const REEL_COUNT = 5;
export const VISIBLE_ROWS = 3;
export const SYMBOL_SIZE = 320;
export const CELL_PAD = 8;
export const CELL_SIZE = SYMBOL_SIZE + CELL_PAD;  // 328
export const GRID_WIDTH = CELL_SIZE * REEL_COUNT;  // 1640
export const GRID_HEIGHT = CELL_SIZE * VISIBLE_ROWS;  // 984

// ── Animation ────────────────────────────────────────────────────
export const SPIN_SPEED = 65;           // px per frame at full speed
export const SPIN_MIN_DURATION = 800;   // ms before first reel can stop
export const REEL_START_INTERVAL = 100; // ms between each reel starting
export const REEL_STOP_INTERVAL = 150;  // ms between each reel stopping
export const ANTICIPATION_PX = 110;     // pull-up distance before spin
export const ANTICIPATION_MS = 350;     // pull-up duration
export const OVERSHOOT_PX = 50;         // bounce past target
export const BOUNCE_DURATION = 200;     // ms to settle back

// ── Symbols ──────────────────────────────────────────────────────
/** Texture names inside the "symbols_static" spritesheet. */
export const SYMBOL_IDS = [
    '1.png', '2.png', '3.png',
    'J.png', 'K.png', 'Q.png', 'A.png',
    'Scatter_01.png', 'Wild_01.png',
] as const;

export type SymbolId = (typeof SYMBOL_IDS)[number];

/**
 * Virtual reel strip per reel (indices into SYMBOL_IDS).
 * Each sub-array is one reel's strip that wraps cyclically.
 */
export const REEL_STRIPS: readonly (readonly number[])[] = [
    [0, 3, 1, 4, 2, 5, 0, 6, 3, 1, 5, 2, 4, 6, 0, 3, 1, 7, 5, 2],
    [1, 4, 0, 5, 3, 6, 2, 0, 4, 1, 3, 5, 6, 2, 0, 4, 8, 1, 3, 5],
    [2, 5, 3, 0, 6, 1, 4, 2, 5, 3, 0, 6, 1, 4, 7, 2, 5, 3, 0, 6],
    [3, 0, 4, 1, 5, 2, 6, 3, 0, 4, 1, 5, 2, 6, 3, 0, 8, 4, 1, 5],
    [4, 1, 5, 2, 0, 3, 6, 4, 1, 5, 2, 0, 3, 6, 4, 7, 1, 5, 2, 0],
];
