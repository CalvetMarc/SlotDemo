/** High-level PCG32 PRNG interface. */
export interface PcgRng {
    /** Random float in [0, 1) */
    random(): number;
    /** Random integer in [min, max] (inclusive both ends). */
    between(min: number, max: number): number;
    /** Cleanup (no-op for JS implementation). */
    destroy(): void;
}

// ── Pure-JS PCG32 implementation (BigInt-based) ──────────────

const MULT = 6364136223846793005n;
const MASK64 = 0xFFFFFFFFFFFFFFFFn;
const MASK32 = 0xFFFFFFFFn;

class PcgRngJs implements PcgRng {
    private _state: bigint;
    private _inc: bigint;

    constructor(seed: bigint, seq: bigint) {
        this._inc = ((seq << 1n) | 1n) & MASK64;
        this._state = 0n;
        this._next();
        this._state = (this._state + seed) & MASK64;
        this._next();
    }

    private _next(): number {
        const old = this._state;
        this._state = (old * MULT + this._inc) & MASK64;
        const xorShifted = Number(((old >> 18n ^ old) >> 27n) & MASK32);
        const rot = Number(old >> 59n);
        return ((xorShifted >>> rot) | (xorShifted << ((-rot) & 31))) >>> 0;
    }

    random(): number {
        return this._next() / 4294967296;
    }

    between(min: number, max: number): number {
        const range = max - min + 1;
        return min + (this._next() % range);
    }

    destroy(): void { /* no-op */ }
}

/** Create a new PCG32 RNG instance (pure JS, no WASM dependency). */
export function createPcgRng(seed?: number): PcgRng {
    return new PcgRngJs(BigInt(seed ?? Date.now()), 1n);
}

/** No-op kept for API compatibility. */
export async function initPcgRng(): Promise<void> {
    // Pure JS — nothing to initialize
}
