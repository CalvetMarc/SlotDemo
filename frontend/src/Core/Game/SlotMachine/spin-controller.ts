import type { SymbolId } from '@shared/types';
import { SYMBOL_IDS, REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
import type { Reel } from './reel';
import { WILD_POP_GROW_MS } from './reel';
import type { ISpinResultProvider, SpinResultWithWins } from './spin-result-provider';
import {
    SPIN_MIN_DURATION, REEL_START_INTERVAL, REEL_STOP_INTERVAL,
    WILD_TENSION_MULTIPLIERS, BOUNCE_DURATION, ANTICIPATION_MS,
} from './slot-config';
import { countWilds } from './debug-spins';
import { GameModel } from './game-model';
import { AudioManager } from '../../Audio/audio-manager';

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
    private _settledReels = new Set<number>();
    private _reelSoundId?: number;
    private _unsubscribeTurbo?: () => void;

    private static readonly _MIN_SKIP_DELAY = 300;
    private static readonly _TURBO_SPIN_MS = 700;

    /** Called when all 5 reels have settled. */
    public onAllReelsStopped?: (result: SpinResultWithWins, isTension: boolean) => void;
    /** Called right before spin begins (view uses this for cleanup). */
    public onSpinStarting?: () => void;

    constructor(config: SpinControllerConfig) {
        this._reels = config.reels;
        this._resultProvider = config.resultProvider;

        this._unsubscribeTurbo = GameModel.turboChanged.connect(({ active }) => {
            if (active && this._pendingResult) {
                this._forceStopAll(this._pendingResult);
            }
        });
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
        this._settledReels.clear();
        this._spinStartTime = Date.now();

        this.onSpinStarting?.();

        // Play reel sound once when first reel starts moving down
        const sfxTimeout = setTimeout(() => {
            this._reelSoundId = AudioManager.play('reelFast');
        }, ANTICIPATION_MS);
        this._stopTimeouts.push(sfxTimeout);

        if (GameModel.isTurbo) {
            for (let i = 0; i < REEL_COUNT; i++) {
                this._reels[i].startSpin();
            }
        } else {
            for (let i = 0; i < REEL_COUNT; i++) {
                const timeout = setTimeout(() => {
                    this._reels[i].startSpin();
                }, i * REEL_START_INTERVAL);
                this._stopTimeouts.push(timeout);
            }
        }

        const isTurbo = GameModel.isTurbo;

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

        if (isTurbo) {
            this._pendingResult = result;
            const elapsed = Date.now() - this._spinStartTime;
            const remaining = Math.max(0, SpinController._TURBO_SPIN_MS - elapsed);
            if (remaining > 0) {
                await new Promise(resolve => setTimeout(resolve, remaining));
            }
            if (this._pendingResult) {
                this._forceStopAll(result);
            }
        } else {
            this._scheduleStops(result);
        }
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
        this._unsubscribeTurbo?.();
    }

    private _forceStopAll(result: SpinResultWithWins): void {
        this.clearTimeouts();

        for (let i = 0; i < REEL_COUNT; i++) {
            if (!this._settledReels.has(i)) {
                this._reels[i].forceStop(result.grid[i]);
            }
            this._reels[i].onSettled = undefined;
        }

        this._isTensionSpin = false;
        this._pendingResult = undefined;
        this._settledReels.clear();
        this._stopReelSound();
        AudioManager.play('symbolLand');
        const bounceTimeout = setTimeout(() => {
            this.onAllReelsStopped?.(result, false);
        }, BOUNCE_DURATION);
        this._stopTimeouts.push(bounceTimeout);
    }

    private _scheduleStops(result: SpinResultWithWins): void {
        this._pendingResult = result;

        if (GameModel.isTurbo) {
            this._forceStopAll(result);
            return;
        }

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

                    this._settledReels.add(i);
                    settledCount++;
                    if (settledCount === REEL_COUNT) {
                        this._pendingResult = undefined;
                        const isTension = this._isTensionSpin;
                        this._isTensionSpin = false;
                        this._stopReelSound();
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

    private _stopReelSound(): void {
        if (this._reelSoundId !== undefined) {
            AudioManager.stop('reelFast', this._reelSoundId);
            this._reelSoundId = undefined;
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
