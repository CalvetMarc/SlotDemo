import type { Reel } from './reel';
import { WILD_POP_GROW_MS } from './reel';
import type { SpinResultWithWins } from './spin-result-provider';
import { REEL_COUNT, REEL_STOP_INTERVAL } from './slot-config';

export interface TensionConfig {
    reels: readonly Reel[];
}

export class TensionController {
    private _reels: readonly Reel[];
    private _tensionDimTimeout?: ReturnType<typeof setTimeout>;
    private _wildShrinkTimeout?: ReturnType<typeof setTimeout>;
    private _shrinkDelayTimeout?: ReturnType<typeof setTimeout>;

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
            this._shrinkDelayTimeout = setTimeout(() => {
                for (const reel of this._reels) reel.shrinkWildPop();
            }, 200);
            this._tensionDimTimeout = setTimeout(() => {
                for (const reel of this._reels) reel.setDim(false);
                this.onTensionResolved?.(result, shouldCelebrate);
            }, TensionController._DIM_HOLD_MS);
        };

        if (popDelay > 0) {
            this._tensionDimTimeout = setTimeout(dimAllThenRestore, popDelay);
        } else {
            dimAllThenRestore();
        }
    }

    playNonTensionResolve(): void {
        for (const reel of this._reels) reel.setDim(false);
        this._wildShrinkTimeout = setTimeout(() => {
            for (const reel of this._reels) reel.shrinkWildPop();
        }, REEL_STOP_INTERVAL * 2);
    }

    clearTimeouts(): void {
        if (this._tensionDimTimeout) {
            clearTimeout(this._tensionDimTimeout);
            this._tensionDimTimeout = undefined;
        }
        if (this._wildShrinkTimeout) {
            clearTimeout(this._wildShrinkTimeout);
            this._wildShrinkTimeout = undefined;
        }
        if (this._shrinkDelayTimeout) {
            clearTimeout(this._shrinkDelayTimeout);
            this._shrinkDelayTimeout = undefined;
        }
    }

    dispose(): void {
        this.clearTimeouts();
    }
}
