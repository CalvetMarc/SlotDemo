import { Signal } from './signal';
import type { LineWinInfo } from '../Game/SlotMachine/win-presentation-controller';

/** Centralized, typed signal registry for the slot machine game. */
export const gameSignals = {

    // ── Player actions ──────────────────────────────────────────

    /** Fired when the player presses the spin button. */
    spinPressed: new Signal<void>(),

    /** Fired when the player taps the spin button to skip (stop reels early). */
    skipRequested: new Signal<void>(),

    /** Fired when the player presses the buy bonus button. */
    buyBonusPressed: new Signal<void>(),

    /** Fired when the player presses the info / menu button. */
    infoPressed: new Signal<void>(),

    /** Fired when the player confirms a buy bonus tier. */
    buyBonusConfirmed: new Signal<{ tier: number }>(),

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

    // ── Win presentation ────────────────────────────────────────

    /** Fired when a line win is being celebrated. */
    lineWinPresented: new Signal<LineWinInfo>(),

    /** Fired when the win presentation is cleared. */
    winPresentationCleared: new Signal<void>(),

} as const;

/** Type helper: extracts the payload type for a given signal key. */
export type SignalPayload<K extends keyof typeof gameSignals> =
    (typeof gameSignals)[K] extends Signal<infer T> ? T : never;
