import type { Reel } from './reel';
import { WILD_POP_GROW_MS } from './reel';
import type { SpinResultWithWins } from './spin-result-provider';
import { REEL_COUNT, REEL_STOP_INTERVAL } from './slot-config';
import { TweenManager, type TweenHandle } from '../../Animation/tween';

export interface TensionConfig {
    reels: readonly Reel[];
}

export class TensionController {
    private _reels: readonly Reel[];
    private _activeTweens: TweenHandle[] = [];

    private static readonly _DIM_HOLD_MS = 1500;
    private static readonly _DIM_EXTRA_MS = 300;

    /** Called when the tension hold period ends. View should emit signals and show win presentation. */
    public onTensionResolved?: (result: SpinResultWithWins, shouldCelebrate: boolean) => void;

    constructor(config: TensionConfig) {
        this._reels = config.reels;
    }

    playTensionSequence(result: SpinResultWithWins, shouldCelebrate: boolean): void {
        const lastReel = this._reels[REEL_COUNT - 1];
        const popDelay = lastReel.hasWildPops
            ? WILD_POP_GROW_MS + TensionController._DIM_EXTRA_MS
            : 0;

        const dimAllThenRestore = () => {
            for (const reel of this._reels) reel.setDim(true);

            this._addTween(TweenManager.add({
                duration: 200,
                context: null,
                tweenFn: () => {},
                onComplete: () => {
                    for (const reel of this._reels) reel.shrinkWildPop();
                },
            }));

            this._addTween(TweenManager.add({
                duration: TensionController._DIM_HOLD_MS,
                context: null,
                tweenFn: () => {},
                onComplete: () => {
                    for (const reel of this._reels) reel.setDim(false);
                    this.onTensionResolved?.(result, shouldCelebrate);
                },
            }));
        };

        if (popDelay > 0) {
            this._addTween(TweenManager.add({
                duration: popDelay,
                context: null,
                tweenFn: () => {},
                onComplete: () => dimAllThenRestore(),
            }));
        } else {
            dimAllThenRestore();
        }
    }

    playNonTensionResolve(): void {
        for (const reel of this._reels) reel.setDim(false);

        this._addTween(TweenManager.add({
            duration: REEL_STOP_INTERVAL * 2,
            context: null,
            tweenFn: () => {},
            onComplete: () => {
                for (const reel of this._reels) reel.shrinkWildPop();
            },
        }));
    }

    clearTimeouts(): void {
        for (const tween of this._activeTweens) {
            tween.kill();
        }
        this._activeTweens.length = 0;
    }

    dispose(): void {
        this.clearTimeouts();
    }

    private _addTween(tween: TweenHandle): void {
        this._activeTweens.push(tween);
    }
}
