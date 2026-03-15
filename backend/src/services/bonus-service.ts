import { createPcgRng, type PcgRng } from './pcg-rng.js';

let rng: PcgRng;

export function initBonusRng(): void {
    rng = createPcgRng();
}

export interface BonusSequenceResult {
    sequence: (number | null)[];
    totalBonusWin: number;
    tier: number;
}

const PRIZE_POOLS: readonly (readonly number[])[] = [
    [30, 75, 150],           // 3 wilds — 3 prizes, pool=255, EV=85x
    [30, 60, 90, 120],       // 4 wilds — 4 prizes, pool=300, EV=150x
    [20, 40, 60, 80, 100],   // 5 wilds — 5 prizes, pool=300, EV=300x
];

const EMPTY_COUNTS = [2, 1, 0]; // skulls per tier

function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function generateBonusSequence(wildCount: number, totalBet: number): BonusSequenceResult {
    const tier = Math.min(wildCount - 3, 2);
    const prizes = PRIZE_POOLS[tier];
    const emptyCount = EMPTY_COUNTS[tier];

    const items: (number | null)[] = [];

    for (const mult of prizes) {
        items.push(Math.round(mult * totalBet * 100) / 100);
    }

    for (let i = 0; i < emptyCount; i++) {
        items.push(null);
    }

    shuffle(items);

    // Truncate at first null (inclusive) — nothing after the skull matters
    const firstNullIndex = items.indexOf(null);
    const sequence = firstNullIndex === -1 ? items : items.slice(0, firstNullIndex + 1);

    const totalBonusWin = sequence
        .filter((v): v is number => v !== null)
        .reduce((sum, v) => sum + v, 0);

    return { sequence, totalBonusWin, tier };
}
