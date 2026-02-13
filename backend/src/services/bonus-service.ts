import { BONUS_AVG_PRIZE_PER_PICK, BONUS_EXPECTED_PICKS } from './spin-service.js';

export interface ChestData {
    prize: number | null; // null = empty (skull)
}

export interface BonusState {
    chests: ChestData[];
    tier: number; // 0=3wilds, 1=4wilds, 2=5wilds
    totalBet: number;
    picked: boolean[];
    totalBonusWin: number;
    isOver: boolean;
}

const PRIZE_POOLS: readonly (readonly number[])[] = [
    [10, 20, 30],           // 3 wilds — 3 prizes (avg=20)
    [10, 15, 25, 30],       // 4 wilds — 4 prizes (avg=20)
    [10, 15, 20, 25, 30],   // 5 wilds — 5 prizes (avg=20)
];

const EMPTY_COUNTS = [2, 1, 0]; // skulls per tier

function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function generateBonusChests(wildCount: number, totalBet: number): BonusState {
    const tier = Math.min(wildCount - 3, 2);
    const prizes = PRIZE_POOLS[tier];
    const emptyCount = EMPTY_COUNTS[tier];

    const chests: ChestData[] = [];

    // Add prize chests (multiplier × totalBet)
    for (const mult of prizes) {
        chests.push({ prize: Math.round(mult * totalBet * 100) / 100 });
    }

    // Add empty (skull) chests
    for (let i = 0; i < emptyCount; i++) {
        chests.push({ prize: null });
    }

    // Shuffle to randomize positions
    shuffle(chests);

    return {
        chests,
        tier,
        totalBet,
        picked: new Array(5).fill(false),
        totalBonusWin: 0,
        isOver: false,
    };
}

export function pickChest(state: BonusState, chestIndex: number): {
    prize: number | null;
    totalBonusWin: number;
    isGameOver: boolean;
} {
    if (state.isOver || chestIndex < 0 || chestIndex >= 5 || state.picked[chestIndex]) {
        throw new Error('Invalid pick');
    }

    state.picked[chestIndex] = true;
    const chest = state.chests[chestIndex];

    if (chest.prize === null) {
        // Hit a skull — bonus over
        state.isOver = true;
        return {
            prize: null,
            totalBonusWin: state.totalBonusWin,
            isGameOver: true,
        };
    }

    state.totalBonusWin += chest.prize;

    // Check if all prize chests found (no more skulls to hit)
    const allPicked = state.picked.every(Boolean);
    if (allPicked) {
        state.isOver = true;
    }

    return {
        prize: chest.prize,
        totalBonusWin: state.totalBonusWin,
        isGameOver: state.isOver,
    };
}
