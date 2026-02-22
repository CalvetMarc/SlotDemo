/**
 * RTP Calculator — brute-forces all possible stop combinations
 * to compute the exact Return to Player percentage.
 *
 * Run: npx tsx backend/src/scripts/rtp-calculator.ts
 */
import {
    REEL_STRIPS, REEL_COUNT, VISIBLE_ROWS, SYMBOL_IDS,
    PAYLINE_COUNT, evaluateWin, bonusExpectedPayout, WILD_PAYS,
} from '../services/spin-service.js';

type SymbolId = (typeof SYMBOL_IDS)[number];

const STRIP_LENGTH = REEL_STRIPS[0].length;
const TOTAL_COMBOS = Math.pow(STRIP_LENGTH, REEL_COUNT);
const TOTAL_BET = 20;

console.log(`RTP Calculator`);
console.log(`==============`);
console.log(`Reels: ${REEL_COUNT} × ${VISIBLE_ROWS}`);
console.log(`Strip length: ${STRIP_LENGTH}`);
console.log(`Paylines: ${PAYLINE_COUNT}`);
console.log(`Total combinations: ${TOTAL_COMBOS.toLocaleString()}`);
console.log(`Bet per spin: ${TOTAL_BET}`);
console.log(`\nCalculating...`);

let totalLinePayout = 0;
let totalWildPayPayout = 0;
let totalBonusPayout = 0;
let winningSpins = 0;
const symbolWins: Map<string, { count: number; payout: number }> = new Map();
const wildHits: Map<number, number> = new Map();

const startTime = performance.now();

for (let s0 = 0; s0 < STRIP_LENGTH; s0++) {
    for (let s1 = 0; s1 < STRIP_LENGTH; s1++) {
        for (let s2 = 0; s2 < STRIP_LENGTH; s2++) {
            for (let s3 = 0; s3 < STRIP_LENGTH; s3++) {
                for (let s4 = 0; s4 < STRIP_LENGTH; s4++) {
                    const grid: SymbolId[][] = [];

                    for (let r = 0; r < REEL_COUNT; r++) {
                        const strip = REEL_STRIPS[r];
                        const column: SymbolId[] = [];
                        for (let row = 0; row < VISIBLE_ROWS; row++) {
                            const idx = ((r === 0 ? s0 : r === 1 ? s1 : r === 2 ? s2 : r === 3 ? s3 : s4) + row) % STRIP_LENGTH;
                            column.push(SYMBOL_IDS[strip[idx]] as SymbolId);
                        }
                        grid.push(column);
                    }

                    const result = evaluateWin(grid, TOTAL_BET);
                    const lineWin = result.totalWin - result.wildPay;
                    const bonusEV = result.bonusTriggered ? bonusExpectedPayout(result.wildCount, TOTAL_BET) : 0;

                    if (result.totalWin > 0 || bonusEV > 0) {
                        winningSpins++;
                    }

                    totalLinePayout += lineWin;
                    totalWildPayPayout += result.wildPay;
                    totalBonusPayout += bonusEV;

                    for (const lw of result.lineWins) {
                        const key = `${lw.symbol}×${lw.count}`;
                        const existing = symbolWins.get(key) ?? { count: 0, payout: 0 };
                        existing.count++;
                        existing.payout += lw.payout;
                        symbolWins.set(key, existing);
                    }

                    if (result.wildCount >= 3) {
                        wildHits.set(result.wildCount, (wildHits.get(result.wildCount) ?? 0) + 1);
                    }
                }
            }
        }
    }
}

const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
const totalWagered = TOTAL_COMBOS * TOTAL_BET;
const totalPayout = totalLinePayout + totalWildPayPayout + totalBonusPayout;
const rtp = (totalPayout / totalWagered) * 100;
const lineRtp = (totalLinePayout / totalWagered) * 100;
const wildPayRtp = (totalWildPayPayout / totalWagered) * 100;
const bonusRtp = (totalBonusPayout / totalWagered) * 100;
const hitRate = (winningSpins / TOTAL_COMBOS) * 100;

console.log(`\nDone in ${elapsed}s\n`);

console.log(`=== RESULTS ===`);
console.log(`Total RTP:      ${rtp.toFixed(4)}%`);
console.log(`  Line RTP:     ${lineRtp.toFixed(4)}%`);
console.log(`  Wild Pay RTP: ${wildPayRtp.toFixed(4)}%`);
console.log(`  Bonus RTP:    ${bonusRtp.toFixed(4)}%`);
console.log(`Hit rate: ${hitRate.toFixed(2)}%`);

console.log(`\n=== PAYLINE BREAKDOWN ===`);
const sortedWins = [...symbolWins.entries()].sort((a, b) => b[1].payout - a[1].payout);
for (const [key, { count, payout }] of sortedWins) {
    const contrib = (payout / totalWagered) * 100;
    console.log(`  ${key.padEnd(20)} hits: ${count.toLocaleString().padStart(10)}  RTP: ${contrib.toFixed(4)}%`);
}

console.log(`\n=== WILD/BONUS BREAKDOWN ===`);
for (const [wc, count] of [...wildHits.entries()].sort((a, b) => a[0] - b[0])) {
    const chestEV = bonusExpectedPayout(wc, TOTAL_BET);
    const wildPayAmt = (WILD_PAYS[wc] ?? 0) * TOTAL_BET;
    const contrib = (count * chestEV / totalWagered) * 100;
    const wildPayContrib = (count * wildPayAmt / totalWagered) * 100;
    console.log(`  ${wc} wilds: ${count.toLocaleString()} hits  chest RTP: ${contrib.toFixed(4)}%  wild pay RTP: ${wildPayContrib.toFixed(4)}%`);
}
