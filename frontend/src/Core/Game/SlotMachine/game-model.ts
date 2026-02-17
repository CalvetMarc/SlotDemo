import { Signal } from '../../Signals/signal';
import { gameSignals } from '../../Signals/game-signals';
import type { SpinResultWithWins } from './spin-result-provider';

export const BET_STEPS: readonly number[] = [
    0.1, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0,
    3, 4, 5, 6, 7, 8, 9, 10,
    15, 20, 25, 30, 35, 40, 45, 50,
    75, 100,
] as const;

const DEFAULT_BET_INDEX = 10; // 2.00

class GameModelClass {
    // ── State ─────────────────────────────────────────────────────
    private _balance = 0;
    private _betIndex = DEFAULT_BET_INDEX;
    private _isSpinning = false;
    private _isTurbo = false;
    private _isAutoSpin = false;
    private _lastResult: SpinResultWithWins | null = null;

    // ── Own signals ───────────────────────────────────────────────
    readonly balanceChanged = new Signal<{ value: number }>();
    readonly betChanged = new Signal<{ amount: number; index: number }>();
    readonly spinningChanged = new Signal<{ isSpinning: boolean }>();
    readonly turboChanged = new Signal<{ active: boolean }>();
    readonly autoSpinChanged = new Signal<{ active: boolean }>();

    // ── Getters ───────────────────────────────────────────────────
    get balance(): number { return this._balance; }
    get betAmount(): number { return BET_STEPS[this._betIndex]; }
    get betIndex(): number { return this._betIndex; }
    get betSteps(): readonly number[] { return BET_STEPS; }
    get isSpinning(): boolean { return this._isSpinning; }
    get isTurbo(): boolean { return this._isTurbo; }
    get isAutoSpin(): boolean { return this._isAutoSpin; }
    get lastResult(): SpinResultWithWins | null { return this._lastResult; }
    get isMinBet(): boolean { return this._betIndex <= 0; }
    get isMaxBet(): boolean { return this._betIndex >= BET_STEPS.length - 1; }

    // ── Setters (with bridge) ─────────────────────────────────────

    setBalance(value: number): void {
        this._balance = value;
        this.balanceChanged.emit({ value });
        gameSignals.balanceUpdated.emit({ value });
    }

    setBetIndex(index: number): void {
        if (index < 0 || index >= BET_STEPS.length) return;
        this._betIndex = index;
        const amount = BET_STEPS[index];
        this.betChanged.emit({ amount, index });
    }

    increaseBet(): void {
        if (!this.isMaxBet) this.setBetIndex(this._betIndex + 1);
    }

    decreaseBet(): void {
        if (!this.isMinBet) this.setBetIndex(this._betIndex - 1);
    }

    setSpinning(value: boolean): void {
        this._isSpinning = value;
        this.spinningChanged.emit({ isSpinning: value });
    }

    setTurbo(active: boolean): void {
        this._isTurbo = active;
        this.turboChanged.emit({ active });
    }

    setAutoSpin(active: boolean): void {
        this._isAutoSpin = active;
        this.autoSpinChanged.emit({ active });
    }

    setLastResult(result: SpinResultWithWins | null): void {
        this._lastResult = result;
    }
}

export const GameModel = new GameModelClass();
