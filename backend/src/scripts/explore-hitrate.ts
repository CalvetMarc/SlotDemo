/**
 * Explore different configurations to reduce hit rate while maintaining ~96.12% RTP.
 * No blanks — every strip position is a real paying symbol.
 *
 * Run: npx tsx backend/src/scripts/explore-hitrate.ts
 */

const VISIBLE_ROWS = 3;
const N_REELS = 5;
const WILD = 7; // index

type Pays = [number, number, number]; // x3, x4, x5

// Current paytable (x totalBet)
const BASE_PAY: Record<number, Pays> = {
    7: [0.50, 1.70, 12.50],  // Wild
    0: [0.45, 1.65, 8.40],   // King
    1: [0.40, 1.25, 4.25],   // Queen
    2: [0.35, 0.85, 2.55],   // Wolf
    6: [0.20, 0.45, 1.70],   // A
    4: [0.15, 0.35, 1.25],   // K
    5: [0.10, 0.25, 0.85],   // Q
    3: [0.10, 0.20, 0.70],   // J
};

const WILD_PAYS_BASE: Record<number, number> = { 3: 2, 4: 5, 5: 20 };
const BONUS_EVS_BASE: Record<number, number> = { 3: 18, 4: 35, 5: 80 };

const PAYLINES_20 = [
    [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
    [0,0,1,0,0],[2,2,1,2,2],[1,2,2,2,1],[1,0,0,0,1],[0,1,1,1,0],
    [2,1,1,1,2],[1,0,1,0,1],[1,2,1,2,1],[0,1,0,1,0],[2,1,2,1,2],
    [0,0,1,2,2],[2,2,1,0,0],[1,0,0,1,2],[1,2,2,1,0],[0,1,2,2,1],
];

const SYM_NAME: Record<number, string> = {
    0: 'King', 1: 'Queen', 2: 'Wolf', 3: 'J', 4: 'K', 5: 'Q', 6: 'A', 7: 'Wild',
};

// ── Current strips ──────────────────────────────────────

const CURRENT_STRIPS: number[][] = [
    [0,3,1,4,2,5,0,6,3,1,5,2,4,6,0,3,1,7,5,2],
    [1,4,0,5,3,6,2,0,4,1,3,5,6,2,0,4,5,1,3,7],
    [2,5,3,0,6,1,4,2,5,3,0,6,1,4,7,2,5,3,0,6],
    [3,0,4,1,5,2,6,3,0,4,1,5,2,6,3,0,5,4,1,7],
    [4,1,5,2,0,3,6,4,1,5,2,0,3,6,4,7,1,5,2,0],
];

// ── Strip builder ───────────────────────────────────────

function buildStrip(freqs: Record<number, number>, stripLen: number, seed: number): number[] {
    const strip: number[] = [];
    for (const [sym, count] of Object.entries(freqs)) {
        for (let i = 0; i < count; i++) strip.push(Number(sym));
    }
    if (strip.length !== stripLen) throw new Error(`Strip length mismatch: ${strip.length} != ${stripLen}`);
    // Seeded Fisher-Yates shuffle
    let s = seed;
    const rng = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = strip.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [strip[i], strip[j]] = [strip[j], strip[i]];
    }
    return strip;
}

function buildStrips(freqs: Record<number, number>, stripLen: number): number[][] {
    return [0, 1, 2, 3, 4].map(r => buildStrip(freqs, stripLen, 1000 + r * 37));
}

// ── Brute-force computation ─────────────────────────────

interface Config {
    name: string;
    strips: number[][];
    paylines: number[][];
    paytable: Record<number, Pays>;
    wildPays: Record<number, number>;
    bonusEvs: Record<number, number>;
}

interface Result {
    name: string;
    hitRate: number;
    lineRtp: number;
    wildPayRtp: number;
    bonusRtp: number;
    totalRtp: number;
    stripLen: number;
    nLines: number;
}

function compute(cfg: Config): Result {
    const { strips, paylines, paytable, wildPays, bonusEvs } = cfg;
    const SL = strips[0].length;
    const nLines = paylines.length;
    const TOTAL_BET = 20;
    const TOTAL_COMBOS = Math.pow(SL, N_REELS);
    const totalWagered = TOTAL_COMBOS * TOTAL_BET;

    let totalLinePayout = 0;
    let totalWildPayPayout = 0;
    let totalBonusPayout = 0;
    let winningSpins = 0;

    for (let s0 = 0; s0 < SL; s0++) {
        for (let s1 = 0; s1 < SL; s1++) {
            for (let s2 = 0; s2 < SL; s2++) {
                for (let s3 = 0; s3 < SL; s3++) {
                    for (let s4 = 0; s4 < SL; s4++) {
                        const stops = [s0, s1, s2, s3, s4];

                        // Build visible grid
                        const grid: number[][] = [];
                        let wildCount = 0;
                        for (let r = 0; r < N_REELS; r++) {
                            const col: number[] = [];
                            let hasWild = false;
                            for (let row = 0; row < VISIBLE_ROWS; row++) {
                                const sym = strips[r][(stops[r] + row) % SL];
                                col.push(sym);
                                if (sym === WILD) hasWild = true;
                            }
                            grid.push(col);
                            if (hasWild) wildCount++;
                        }

                        // Evaluate paylines
                        let linePayout = 0;
                        for (const pl of paylines) {
                            const syms: number[] = [];
                            for (let r = 0; r < N_REELS; r++) syms.push(grid[r][pl[r]]);

                            let base = -1;
                            for (const sym of syms) {
                                if (sym !== WILD) { base = sym; break; }
                            }
                            if (base === -1) base = WILD;

                            let count = 0;
                            for (let i = 0; i < N_REELS; i++) {
                                if (syms[i] === base || syms[i] === WILD) count++;
                                else break;
                            }

                            if (count >= 3) {
                                const pays = paytable[base];
                                if (pays) {
                                    const payout = pays[count - 3] * TOTAL_BET;
                                    if (payout > 0) linePayout += payout;
                                }
                            }
                        }

                        // Wild pay
                        const wpMult = wildPays[wildCount] ?? 0;
                        const wpPayout = wpMult * TOTAL_BET;

                        // Bonus EV
                        const bonusEV = wildCount >= 3 ? (bonusEvs[wildCount] ?? 0) * TOTAL_BET : 0;

                        if (linePayout > 0 || wpPayout > 0 || bonusEV > 0) winningSpins++;

                        totalLinePayout += linePayout;
                        totalWildPayPayout += wpPayout;
                        totalBonusPayout += bonusEV;
                    }
                }
            }
        }
    }

    return {
        name: cfg.name,
        hitRate: winningSpins / TOTAL_COMBOS * 100,
        lineRtp: totalLinePayout / totalWagered * 100,
        wildPayRtp: totalWildPayPayout / totalWagered * 100,
        bonusRtp: totalBonusPayout / totalWagered * 100,
        totalRtp: (totalLinePayout + totalWildPayPayout + totalBonusPayout) / totalWagered * 100,
        stripLen: SL,
        nLines: paylines.length,
    };
}

// ── Scale helpers ───────────────────────────────────────

function scalePay(base: Record<number, Pays>, factor: number): Record<number, Pays> {
    const result: Record<number, Pays> = {};
    for (const [sym, pays] of Object.entries(base)) {
        result[Number(sym)] = [
            Math.round(pays[0] * factor * 100) / 100,
            Math.round(pays[1] * factor * 100) / 100,
            Math.round(pays[2] * factor * 100) / 100,
        ];
    }
    return result;
}

function scaleWB(wildPays: Record<number, number>, bonusEvs: Record<number, number>, factor: number) {
    const wp: Record<number, number> = {};
    const be: Record<number, number> = {};
    for (const [k, v] of Object.entries(wildPays)) wp[Number(k)] = Math.round(v * factor * 10) / 10;
    for (const [k, v] of Object.entries(bonusEvs)) be[Number(k)] = Math.round(v * factor * 10) / 10;
    return { wp, be };
}

// ── Configurations to test ──────────────────────────────

const configs: Config[] = [];

// 1) Current baseline
configs.push({
    name: 'CURRENT (S20, 20L)',
    strips: CURRENT_STRIPS,
    paylines: PAYLINES_20,
    paytable: BASE_PAY,
    wildPays: WILD_PAYS_BASE,
    bonusEvs: BONUS_EVS_BASE,
});

// 2) Strip 25 proportional, 20 paylines
configs.push({
    name: 'S25 prop, 20L',
    strips: buildStrips({0:3, 1:3, 2:3, 3:4, 4:3, 5:4, 6:4, 7:1}, 25),
    paylines: PAYLINES_20,
    paytable: BASE_PAY,
    wildPays: WILD_PAYS_BASE,
    bonusEvs: BONUS_EVS_BASE,
});

// 3) Strip 28 proportional, 20 paylines
configs.push({
    name: 'S28 prop, 20L',
    strips: buildStrips({0:4, 1:4, 2:4, 3:4, 4:3, 5:4, 6:4, 7:1}, 28),
    paylines: PAYLINES_20,
    paytable: BASE_PAY,
    wildPays: WILD_PAYS_BASE,
    bonusEvs: BONUS_EVS_BASE,
});

// 4) Strip 30 proportional, 20 paylines
configs.push({
    name: 'S30 prop, 20L',
    strips: buildStrips({0:4, 1:4, 2:4, 3:5, 4:4, 5:4, 6:4, 7:1}, 30),
    paylines: PAYLINES_20,
    paytable: BASE_PAY,
    wildPays: WILD_PAYS_BASE,
    bonusEvs: BONUS_EVS_BASE,
});

// 5) Current strips, 10 paylines
configs.push({
    name: 'S20, 10L',
    strips: CURRENT_STRIPS,
    paylines: PAYLINES_20.slice(0, 10),
    paytable: BASE_PAY,
    wildPays: WILD_PAYS_BASE,
    bonusEvs: BONUS_EVS_BASE,
});

// 6) S25 prop, 10 paylines
configs.push({
    name: 'S25 prop, 10L',
    strips: buildStrips({0:3, 1:3, 2:3, 3:4, 4:3, 5:4, 6:4, 7:1}, 25),
    paylines: PAYLINES_20.slice(0, 10),
    paytable: BASE_PAY,
    wildPays: WILD_PAYS_BASE,
    bonusEvs: BONUS_EVS_BASE,
});

// 7) Current strips, J/Q x3 = 0 (only pay x4+)
const payNoX3JQ: Record<number, Pays> = { ...BASE_PAY };
payNoX3JQ[3] = [0, 0.20, 0.70];  // J: x3=0
payNoX3JQ[5] = [0, 0.25, 0.85];  // Q: x3=0
configs.push({
    name: 'S20, J/Q x3=0',
    strips: CURRENT_STRIPS,
    paylines: PAYLINES_20,
    paytable: payNoX3JQ,
    wildPays: WILD_PAYS_BASE,
    bonusEvs: BONUS_EVS_BASE,
});

// 8) S25, J/Q x3 = 0
configs.push({
    name: 'S25, J/Q x3=0',
    strips: buildStrips({0:3, 1:3, 2:3, 3:4, 4:3, 5:4, 6:4, 7:1}, 25),
    paylines: PAYLINES_20.slice(0, 10),
    paytable: payNoX3JQ,
    wildPays: WILD_PAYS_BASE,
    bonusEvs: BONUS_EVS_BASE,
});

// 9) S25 with skewed distribution: premium rare, low common
configs.push({
    name: 'S25 skew, 20L',
    strips: buildStrips({0:2, 1:2, 2:3, 3:5, 4:4, 5:4, 6:4, 7:1}, 25),
    paylines: PAYLINES_20,
    paytable: BASE_PAY,
    wildPays: WILD_PAYS_BASE,
    bonusEvs: BONUS_EVS_BASE,
});

// 10) S28 skewed, 20L
configs.push({
    name: 'S28 skew, 20L',
    strips: buildStrips({0:2, 1:3, 2:3, 3:5, 4:5, 5:5, 6:4, 7:1}, 28),
    paylines: PAYLINES_20,
    paytable: BASE_PAY,
    wildPays: WILD_PAYS_BASE,
    bonusEvs: BONUS_EVS_BASE,
});

// 11) S30 skewed (King:2, Queen:3), 20L
configs.push({
    name: 'S30 skew, 20L',
    strips: buildStrips({0:2, 1:3, 2:3, 3:6, 4:5, 5:5, 6:5, 7:1}, 30),
    paylines: PAYLINES_20,
    paytable: BASE_PAY,
    wildPays: WILD_PAYS_BASE,
    bonusEvs: BONUS_EVS_BASE,
});

// 12) S25 prop, J/Q/K x3=0, 20L
const payNoX3JQK: Record<number, Pays> = { ...BASE_PAY };
payNoX3JQK[3] = [0, 0.20, 0.70];
payNoX3JQK[5] = [0, 0.25, 0.85];
payNoX3JQK[4] = [0, 0.35, 1.25];
configs.push({
    name: 'S25, J/Q/K x3=0, 20L',
    strips: buildStrips({0:3, 1:3, 2:3, 3:4, 4:3, 5:4, 6:4, 7:1}, 25),
    paylines: PAYLINES_20,
    paytable: payNoX3JQK,
    wildPays: WILD_PAYS_BASE,
    bonusEvs: BONUS_EVS_BASE,
});

// 13) S28, J/Q/K x3=0, 20L
configs.push({
    name: 'S28, J/Q/K x3=0, 20L',
    strips: buildStrips({0:4, 1:4, 2:4, 3:4, 4:3, 5:4, 6:4, 7:1}, 28),
    paylines: PAYLINES_20,
    paytable: payNoX3JQK,
    wildPays: WILD_PAYS_BASE,
    bonusEvs: BONUS_EVS_BASE,
});

// ── Run all configs ─────────────────────────────────────

console.log('Hit Rate Exploration — No Blanks');
console.log('='.repeat(100));
console.log(
    'Config'.padEnd(28),
    'SLen'.padStart(4),
    'Lines'.padStart(5),
    'HitRate'.padStart(8),
    'LineRTP'.padStart(9),
    'WP_RTP'.padStart(8),
    'BonusRTP'.padStart(9),
    'TotalRTP'.padStart(9),
);
console.log('-'.repeat(100));

const results: Result[] = [];
for (const cfg of configs) {
    const t0 = performance.now();
    const r = compute(cfg);
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    results.push(r);

    const marker = r.hitRate >= 22 && r.hitRate <= 30 ? ' <<<' : '';
    console.log(
        r.name.padEnd(28),
        String(r.stripLen).padStart(4),
        String(r.nLines).padStart(5),
        `${r.hitRate.toFixed(2)}%`.padStart(8),
        `${r.lineRtp.toFixed(2)}%`.padStart(9),
        `${r.wildPayRtp.toFixed(2)}%`.padStart(8),
        `${r.bonusRtp.toFixed(2)}%`.padStart(9),
        `${r.totalRtp.toFixed(2)}%`.padStart(9),
        `(${elapsed}s)${marker}`,
    );
}

// ── Recommendations ─────────────────────────────────────

console.log('\n\n=== CANDIDATES IN 22-30% HIT RATE RANGE ===\n');

for (const r of results) {
    if (r.hitRate < 22 || r.hitRate > 30) continue;

    // Compute scaling needed for 96.12% total RTP
    const targetTotal = 96.1232;
    const currentWB = r.wildPayRtp + r.bonusRtp;
    // Strategy: scale paytable to fix line RTP, scale WB to fix WP+bonus
    const targetLineRtp = 37.9888;
    const targetWB = targetTotal - targetLineRtp;
    const lineScale = targetLineRtp / r.lineRtp;
    const wbScale = targetWB / currentWB;

    console.log(`--- ${r.name} ---`);
    console.log(`  Hit rate:  ${r.hitRate.toFixed(2)}%`);
    console.log(`  Raw RTP:   line=${r.lineRtp.toFixed(2)}%  wp=${r.wildPayRtp.toFixed(2)}%  bonus=${r.bonusRtp.toFixed(2)}%  total=${r.totalRtp.toFixed(2)}%`);
    console.log(`  To reach 96.12% with 38/58 split:`);
    console.log(`    Paytable scale:  ${lineScale.toFixed(3)}x`);
    console.log(`    WB scale:        ${wbScale.toFixed(3)}x`);
    console.log(`    King x5: ${(8.40 * lineScale).toFixed(2)}x  Wild x5: ${(12.50 * lineScale).toFixed(2)}x`);
    console.log(`    Wild Pay: 3→${(2 * wbScale).toFixed(1)}x  4→${(5 * wbScale).toFixed(1)}x  5→${(20 * wbScale).toFixed(1)}x`);
    console.log(`    Bonus EVs: T0→${(18 * wbScale).toFixed(1)}x  T1→${(35 * wbScale).toFixed(1)}x  T2→${(80 * wbScale).toFixed(1)}x`);
    console.log();
}
