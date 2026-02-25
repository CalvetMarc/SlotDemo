import type { SymbolId } from '@shared/types';
import { SYMBOL_IDS, REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
import type { Reel } from './reel';
import { WILD_POP_GROW_MS } from './reel';
import type { ISpinResultProvider, SpinResultWithWins } from './spin-result-provider';
import {
    SPIN_MIN_DURATION, REEL_START_INTERVAL, REEL_STOP_INTERVAL,
    WILD_TENSION_MULTIPLIERS,
} from './slot-config';
import { countWilds } from './debug-spins';
import { GameModel } from './game-model';

export interface SpinControllerConfig {
    reels: readonly Reel[];
    resultProvider: ISpinResultProvider;
}

export class SpinController {
    private _reels: readonly Reel[];
    private _resultProvider: ISpinResultProvider;
    private _stopTimeouts: ReturnType<typeof setTimeout>[] = [];
    private _isTensionSpin = false;
    private _forcedResult?: SpinResultWithWins;
    private _pendingResult?: SpinResultWithWins;
    private _spinStartTime = 0;

    private static readonly _MIN_SKIP_DELAY = 300;

    /** Called when all 5 reels have settled. */
    public onAllReelsStopped?: (result: SpinResultWithWins, isTension: boolean) => void;
    /** Called right before spin begins (view uses this for cleanup). */
    public onSpinStarting?: () => void;

    constructor(config: SpinControllerConfig) {
        this._reels = config.reels;
        this._resultProvider = config.resultProvider;
    }

    get isSpinning(): boolean {
        return GameModel.isSpinning;
    }

    getBetAmount(): number {
        return GameModel.betAmount;
    }

    setForcedResult(result: SpinResultWithWins): void {
        this._forcedResult = result;
    }

    async startSpin(): Promise<void> {
        if (GameModel.isSpinning) return;
        GameModel.setSpinning(true);
        this._pendingResult = undefined;
        this._spinStartTime = Date.now();

        this.onSpinStarting?.();

        for (let i = 0; i < REEL_COUNT; i++) {
            const timeout = setTimeout(() => {
                this._reels[i].startSpin();
            }, i * REEL_START_INTERVAL);
            this._stopTimeouts.push(timeout);
        }

        let result: SpinResultWithWins;
        if (this._forcedResult) {
            result = this._forcedResult;
            this._forcedResult = undefined;
        } else {
            try {
                result = await this._resultProvider.generateResult(GameModel.betAmount);
            } catch (error) {
                console.error('Spin request failed:', error);
                result = this._generateLocalFallback();
            }
        }

        this._scheduleStops(result);
    }

    clearTimeouts(): void {
        for (const timeout of this._stopTimeouts) {
            clearTimeout(timeout);
        }
        this._stopTimeouts.length = 0;
    }

    skipSpin(): void {
        if (!GameModel.isSpinning) return;
        if (!this._pendingResult) return;
        if (Date.now() - this._spinStartTime < SpinController._MIN_SKIP_DELAY) return;

        this._forceStopAll(this._pendingResult);
    }

    dispose(): void {
        this.clearTimeouts();
    }

    private _forceStopAll(result: SpinResultWithWins): void {
        this.clearTimeouts();

        for (let i = 0; i < REEL_COUNT; i++) {
            this._reels[i].forceStop(result.grid[i]);
            this._reels[i].onSettled = undefined;
        }

        this._isTensionSpin = false;
        this._pendingResult = undefined;
        this.onAllReelsStopped?.(result, false);
    }

    private _scheduleStops(result: SpinResultWithWins): void {
        this._pendingResult = result;
        let settledCount = 0;
        let cumulativeDelay = SPIN_MIN_DURATION;
        let wildsSoFar = 0;

        const hasTensionAfter: boolean[] = [];
        let preWilds = 0;
        for (let i = 0; i < REEL_COUNT; i++) {
            for (const id of result.grid[i]) {
                if (id === 'Wild_01.png') preWilds++;
            }
            const mult = WILD_TENSION_MULTIPLIERS[preWilds] ?? 1;
            hasTensionAfter.push(mult > 1);
        }
        this._isTensionSpin = hasTensionAfter.slice(0, REEL_COUNT - 1).some(v => v);

        for (let i = 0; i < REEL_COUNT; i++) {
            const delay = cumulativeDelay;
            const timeout = setTimeout(() => {
                this._reels[i].onSettled = () => {
                    this._reels[i].startWildPop();

                    if (i < REEL_COUNT - 1 && hasTensionAfter[i]) {
                        const applySpotlight = () => {
                            if (this._reels.every(r => r.isIdle)) return;
                            for (let j = 0; j < REEL_COUNT; j++) {
                                this._reels[j].setDim(j !== i + 1);
                            }
                        };
                        if (this._reels[i].hasWildPops) {
                            const t = setTimeout(applySpotlight, WILD_POP_GROW_MS);
                            this._stopTimeouts.push(t);
                        } else {
                            applySpotlight();
                        }
                    }

                    settledCount++;
                    if (settledCount === REEL_COUNT) {
                        const isTension = this._isTensionSpin;
                        this._isTensionSpin = false;
                        this.onAllReelsStopped?.(result, isTension);
                    }
                };
                this._reels[i].stopAt(result.grid[i]);
            }, delay);
            this._stopTimeouts.push(timeout);

            for (const id of result.grid[i]) {
                if (id === 'Wild_01.png') wildsSoFar++;
            }

            const multiplier = WILD_TENSION_MULTIPLIERS[wildsSoFar] ?? 1;
            cumulativeDelay += REEL_STOP_INTERVAL * multiplier;
        }
    }

    private _generateLocalFallback(): SpinResultWithWins {
        const grid: SymbolId[][] = [];
        for (let r = 0; r < REEL_COUNT; r++) {
            const column: SymbolId[] = [];
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                column.push(SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)]);
            }
            grid.push(column);
        }
        const wildCount = countWilds(grid);
        return { grid, winAmount: 0, lineWins: [], wildCount, bonusTriggered: wildCount >= 3, wildPay: 0 };
    }
}
