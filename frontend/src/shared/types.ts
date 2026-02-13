// ── Grid ──────────────────────────────────────────────────────────
export const REEL_COUNT = 5;
export const VISIBLE_ROWS = 3;

// ── Symbols ──────────────────────────────────────────────────────
export const SYMBOL_IDS = [
    '1.png', '2.png', '3.png',
    'J.png', 'K.png', 'Q.png', 'A.png',
    'Wild_01.png',
] as const;

export type SymbolId = (typeof SYMBOL_IDS)[number];

// ── Win types ────────────────────────────────────────────────────

export interface LineWin {
    lineIndex: number;
    symbol: SymbolId;
    count: number;
    payout: number;
}

// ── API types ────────────────────────────────────────────────────

export interface SpinResult {
    grid: SymbolId[][];
}

export interface SpinRequest {
    betAmount: number;
}

export interface SpinResponse {
    grid: SymbolId[][];
    balance: number;
    winAmount: number;
    lineWins: LineWin[];
    wildCount: number;
    bonusTriggered: boolean;
}

export interface BonusStartResponse {
    chestCount: number;
    tier: number;
}

export interface BonusPickResponse {
    prize: number | null;
    totalBonusWin: number;
    isGameOver: boolean;
    balance?: number;
}

export interface SessionResponse {
    token: string;
    balance: number;
    gamePhase: 'base' | 'bonus';
    initialGrid: SymbolId[][];
}

export interface HeartbeatResponse {
    token: string;
}
