// Re-export shared types so existing imports keep working
export { SYMBOL_IDS, REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
export type { SymbolId } from '@shared/types';

// ── Grid (derived, frontend-only) ───────────────────────────────
import { REEL_COUNT, VISIBLE_ROWS } from '@shared/types';

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
