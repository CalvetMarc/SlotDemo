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
    wildPay: number;
}

export interface BuyBonusRequest {
    betAmount: number;
    tier: number; // 1 or 2
}

export interface BuyBonusResponse {
    balance: number;
    tier: number;
    wildPay: number;
    wildCount: number;
}

export interface BonusStartResponse {
    chests: (number | null)[];
    tier: number;
}

export interface BonusCollectResponse {
    balance: number;
}

export interface StartResponse {
    token: string;
    balance: number;
    gamePhase: 'base' | 'bonus';
    initialGrid: SymbolId[][];
}
