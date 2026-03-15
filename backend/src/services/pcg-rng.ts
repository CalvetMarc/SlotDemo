import { readFileSync } from 'fs';
import { join } from 'path';

// ── WASM export map (from emscripten-compiled pcg_rng.wasm) ──

interface PcgWasmExports {
    c: WebAssembly.Memory;       // memory
    d: () => void;               // __init_runtime
    e: (seed: bigint, seq: bigint) => number;  // pcg_create
    f: (rng: number) => void;    // pcg_destroy
    g: (rng: number) => number;  // pcg32
    h: (rng: number) => number;  // pcg_normalized
    i: (rng: number, min: number, max: number, incMin: number, incMax: number) => number; // pcg_between
    j: (rng: number, min: number, max: number, incMin: number, incMax: number) => number; // pcg_between_u32
    k: (rng: number, min: number, max: number) => number; // pcg_between_float
    l: (rng: number) => number;  // pcg_bool
}

/** High-level PCG32 PRNG wrapper backed by WebAssembly. */
export interface PcgRng {
    /** Random float in [0, 1) — drop-in replacement for Math.random(). */
    random(): number;
    /** Random integer in [min, max] (inclusive both ends). */
    between(min: number, max: number): number;
    /** Free the WASM-allocated RNG instance. */
    destroy(): void;
}

let wasmExports: PcgWasmExports | null = null;

async function loadWasm(): Promise<PcgWasmExports> {
    if (wasmExports) return wasmExports;

    const wasmPath = join(__dirname, '..', 'wasm', 'pcg_rng.wasm');
    const wasmBuffer = readFileSync(wasmPath);

    const memory = new WebAssembly.Memory({ initial: 256, maximum: 2048 });

    const importObject = {
        a: {
            a: () => { throw new Error('PCG WASM abort'); },
            b: (requested: number) => {
                const pages = Math.ceil((requested - memory.buffer.byteLength + 65535) / 65536);
                try { memory.grow(pages); return 1; } catch { return 0; }
            },
        },
    };

    const { instance } = await WebAssembly.instantiate(wasmBuffer, importObject);
    wasmExports = instance.exports as unknown as PcgWasmExports;

    // Initialize the emscripten runtime
    wasmExports.d();

    return wasmExports;
}

/** Create a new PCG32 RNG instance. Must be called after `initPcgRng()`. */
export function createPcgRng(seed?: number): PcgRng {
    if (!wasmExports) throw new Error('PCG WASM not initialized — call initPcgRng() first');

    const seedBig = BigInt(seed ?? Date.now());
    const seq = BigInt(1);
    const ptr = wasmExports.e(seedBig, seq);

    return {
        random(): number {
            return wasmExports!.h(ptr);
        },
        between(min: number, max: number): number {
            return wasmExports!.i(ptr, min, max, 1, 1);
        },
        destroy(): void {
            wasmExports!.f(ptr);
        },
    };
}

/** Load the WASM module. Call once at server startup. */
export async function initPcgRng(): Promise<void> {
    await loadWasm();
}
