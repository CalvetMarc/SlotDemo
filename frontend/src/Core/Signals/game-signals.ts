import { Signal } from './signal';

/** Centralized, typed signal registry for the slot machine game. */
export const gameSignals = {

    // ── Player actions ──────────────────────────────────────────

    /** Fired when the player presses the spin button. */
    spinPressed: new Signal<void>(),

    // ── Screen transitions ────────────────────────────────────────

    /** Fired when a view requests transition to the bonus screen. */
    requestBonusTransition: new Signal<void>(),

    /** Fired when a view requests transition back to the base screen. */
    requestBaseTransition: new Signal<void>(),

    // ── Game state ──────────────────────────────────────────────

    /** Fired when balance updates. */
    balanceUpdated: new Signal<{ value: number }>(),

    /** Fired when a 401 is received, meaning the JWT expired. */
    sessionExpired: new Signal<void>(),

} as const;

/** Type helper: extracts the payload type for a given signal key. */
export type SignalPayload<K extends keyof typeof gameSignals> =
    (typeof gameSignals)[K] extends Signal<infer T> ? T : never;
