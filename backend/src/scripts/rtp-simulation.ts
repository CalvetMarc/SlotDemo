/**
 * RTP Monte Carlo Simulation — simulates actual gameplay
 * including real bonus pick-me rounds to verify theoretical RTP.
 *
 * Run: npx tsx backend/src/scripts/rtp-simulation.ts
 */
import {
    REEL_STRIPS, REEL_COUNT, VISIBLE_ROWS, SYMBOL_IDS,
    PAYLINE_COUNT, evaluateWin,
} from '../services/spin-service.js';
import { generateBonusChests, pickChest } from '../services/bonus-service.js';

type SymbolId = (typeof SYMBOL_IDS)[number];

const STRIP_LENGTH = REEL_STRIPS[0].length;
const NUM_SPINS = 10_000_000;
const BET_PER_LINE = 1;
const TOTAL_BET = BET_PER_LINE * PAYLINE_COUNT;

console.log(`RTP Monte Carlo Simulation`);
console.log(`==========================`);
console.log(`Spins: ${NUM_SPINS.toLocaleString()}`);
console.log(`Bet per spin: ${TOTAL_BET}`);
console.log(`\nSimulating...`);

let totalWagered = 0;
let totalLinePayout = 0;
let totalBonusPayout = 0;
let bonusTriggers = 0;
let winningSpins = 0;

const startTime = performance.now();

for (let spin = 0; spin < NUM_SPINS; spin++) {
    // Generate random stops
    const grid: SymbolId[][] = [];
    for (let r = 0; r < REEL_COUNT; r++) {
        const strip = REEL_STRIPS[r];
        const stopIndex = Math.floor(Math.random() * strip.length);
        const column: SymbolId[] = [];
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            const idx = (stopIndex + row) % STRIP_LENGTH;
            column.push(SYMBOL_IDS[strip[idx]] as SymbolId);
        }
        grid.push(column);
    }

    const result = evaluateWin(grid, BET_PER_LINE);
    totalWagered += TOTAL_BET;
    totalLinePayout += result.totalWin;

    if (result.totalWin > 0) winningSpins++;

    // If bonus triggered, simulate the actual pick-me game
    if (result.bonusTriggered) {
        bonusTriggers++;
        const state = generateBonusChests(result.scatterCount, TOTAL_BET);

        // Pick chests in random order until game over
        const indices = [0, 1, 2, 3, 4];
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        for (const idx of indices) {
            if (state.isOver) break;
            const pickResult = pickChest(state, idx);
            if (pickResult.isGameOver) {
                totalBonusPayout += pickResult.totalBonusWin;
                if (pickResult.totalBonusWin > 0) winningSpins++;
                break;
            }
        }
    }

    // Progress
    if ((spin + 1) % 1_000_000 === 0) {
        const pct = ((spin + 1) / NUM_SPINS * 100).toFixed(0);
        const currentRtp = ((totalLinePayout + totalBonusPayout) / totalWagered * 100).toFixed(2);
        process.stdout.write(`  ${pct}% — running RTP: ${currentRtp}%\r`);
    }
}

const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
const totalPayout = totalLinePayout + totalBonusPayout;
const rtp = (totalPayout / totalWagered) * 100;
const lineRtp = (totalLinePayout / totalWagered) * 100;
const bonusRtp = (totalBonusPayout / totalWagered) * 100;
const hitRate = (winningSpins / NUM_SPINS) * 100;
const bonusFreq = (bonusTriggers / NUM_SPINS) * 100;

console.log(`\nDone in ${elapsed}s\n`);

console.log(`=== SIMULATION RESULTS (${NUM_SPINS.toLocaleString()} spins) ===`);
console.log(`Total RTP:     ${rtp.toFixed(4)}%`);
console.log(`  Line RTP:    ${lineRtp.toFixed(4)}%`);
console.log(`  Bonus RTP:   ${bonusRtp.toFixed(4)}%`);
console.log(`Hit rate:      ${hitRate.toFixed(2)}%`);
console.log(`Bonus triggers: ${bonusTriggers.toLocaleString()} (${bonusFreq.toFixed(3)}% of spins)`);
console.log(`Avg bonus win: ${bonusTriggers > 0 ? (totalBonusPayout / bonusTriggers).toFixed(2) : 'N/A'}`);

console.log(`\n=== THEORETICAL (exact) ===`);
console.log(`Total RTP:     96.0865%`);
console.log(`  Line RTP:    37.9522%`);
console.log(`  Bonus RTP:   58.1344%`);
