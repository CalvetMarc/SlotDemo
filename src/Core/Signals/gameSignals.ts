import { Signal } from './Signal';

/** Centralized, typed signal registry for the slot machine game. */
export const gameSignals = {

    // ── Player actions ──────────────────────────────────────────

    /** Fired when the player presses the spin button. */
    spinPressed: new Signal<void>(),

    /** Fired when auto-spin mode is toggled. */
    autoSpinToggled: new Signal<{ active: boolean }>(),

    /** Fired when turbo mode is toggled. */
    turboToggled: new Signal<{ active: boolean }>(),

    /** Fired when the bet value changes. */
    betChanged: new Signal<{ amount: number }>(),

    /** Fired when audio is toggled. */
    audioToggled: new Signal<{ on: boolean }>(),

    /** Fired when the buy-bonus button is pressed. */
    buyBonusPressed: new Signal<void>(),

    /** Fired when the info button is pressed. */
    infoPressed: new Signal<void>(),

    /** Fired when the menu button is pressed. */
    menuPressed: new Signal<void>(),

    // ── Game state ──────────────────────────────────────────────

    /** Fired when balance updates. */
    balanceUpdated: new Signal<{ value: number }>(),

    /** Fired when a screen transition occurs. */
    screenChanged: new Signal<{ from: string; to: string }>(),

    /** Fired when layout/canvas changes (orientation, resize). */
    layoutChanged: new Signal<{ canvasId: string }>(),

} as const;

/** Type helper: extracts the payload type for a given signal key. */
export type SignalPayload<K extends keyof typeof gameSignals> =
    (typeof gameSignals)[K] extends Signal<infer T> ? T : never;
