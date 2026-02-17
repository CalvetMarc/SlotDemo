import { Container } from 'pixi.js';
import type { Reel } from './reel';
import type { SpinResultWithWins } from './spin-result-provider';
import type { LineWin } from '@shared/types';
import { REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
import { getWinPositions, getFullPaylinePositions } from './slot-config';
import { getWinVfxFrames } from './symbol-view';

export interface WinPresentationConfig {
    reels: readonly Reel[];
    reelContainer: Container;
}

export class WinPresentationController {
    private _reels: readonly Reel[];
    private _reelContainer: Container;

    private _vfxLayer!: Container;
    private _pendingLineWins: LineWin[] = [];
    private _currentLineIndex = 0;
    private _linePauseElapsed = -1;

    private _isBonusPending = false;
    private _hasBonusCelebrationStep = false;
    private _bonusWildPositions = new Set<string>();

    private static readonly _LINE_PAUSE_MS = 800;

    public onBonusDismissed?: () => void;

    constructor(config: WinPresentationConfig) {
        this._reels = config.reels;
        this._reelContainer = config.reelContainer;
        this._vfxLayer = new Container();
        this._reelContainer.addChild(this._vfxLayer);
    }

    get vfxLayer(): Container {
        return this._vfxLayer;
    }

    get isBonusPending(): boolean {
        return this._isBonusPending;
    }

    setupBonus(result: SpinResultWithWins): void {
        this._isBonusPending = true;
        this._hasBonusCelebrationStep = true;
        this._bonusWildPositions.clear();
        for (let reel = 0; reel < REEL_COUNT; reel++) {
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                if (result.grid[reel][row] === 'Wild_01.png') {
                    this._bonusWildPositions.add(`${reel},${row}`);
                }
            }
        }
    }

    show(result: SpinResultWithWins): void {
        if (this._reels[0].isCelebrating || !this._reels[0].isIdle) return;

        for (const reel of this._reels) reel.clearWildPop();

        this._pendingLineWins = result.lineWins;
        this._currentLineIndex = 0;

        if (this._hasBonusCelebrationStep) {
            this._presentBonusStep();
        } else if (this._pendingLineWins.length > 0) {
            this._presentCurrentLine();
        }

        if (this._isBonusPending) {
            this._addBonusDismissListeners();
        }
    }

    update(deltaMs: number): void {
        if (this._pendingLineWins.length === 0 && !this._hasBonusCelebrationStep) return;

        if (this._linePauseElapsed >= 0) {
            this._linePauseElapsed += deltaMs;
            if (this._linePauseElapsed >= WinPresentationController._LINE_PAUSE_MS) {
                this._linePauseElapsed = -1;
                const totalSteps = this._pendingLineWins.length
                    + (this._hasBonusCelebrationStep ? 1 : 0);
                if (totalSteps > 1) {
                    this._advanceStep();
                } else {
                    for (const reel of this._reels) reel.restartCelebration();
                }
            }
            return;
        }

        if (!this._reels.some(r => r.isCelebrating)) return;

        let allDone = true;
        for (const reel of this._reels) {
            if (!reel.updateCelebration(deltaMs)) {
                allDone = false;
            }
        }

        if (allDone) {
            this._linePauseElapsed = 0;
        }
    }

    clear(): void {
        this._clearLineVisuals();
        this._pendingLineWins = [];
        this._currentLineIndex = 0;
        this._linePauseElapsed = -1;
        this._hasBonusCelebrationStep = false;
        this._bonusWildPositions.clear();
        this._isBonusPending = false;
        this._removeBonusDismissListeners();
    }

    dispose(): void {
        this.clear();
    }

    private _presentCurrentLine(): void {
        this._clearLineVisuals();

        const lineIdx = this._hasBonusCelebrationStep
            ? this._currentLineIndex - 1
            : this._currentLineIndex;
        const lw = this._pendingLineWins[lineIdx];
        const winPositions = getWinPositions([lw]);
        const fullPositions = getFullPaylinePositions([lw]);
        const vfxFrames = getWinVfxFrames();

        for (let reel = 0; reel < REEL_COUNT; reel++) {
            const winRows = new Set<number>();
            const vfxRows = new Set<number>();
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                const key = `${reel},${row}`;
                if (winPositions.has(key)) winRows.add(row);
                if (fullPositions.has(key)) vfxRows.add(row);
            }
            this._reels[reel].setCelebration(winRows, vfxRows, this._vfxLayer, vfxFrames);
        }
    }

    private _advanceStep(): void {
        const totalSteps = this._pendingLineWins.length
            + (this._hasBonusCelebrationStep ? 1 : 0);
        this._currentLineIndex = (this._currentLineIndex + 1) % totalSteps;

        if (this._hasBonusCelebrationStep && this._currentLineIndex === 0) {
            this._presentBonusStep();
        } else {
            this._presentCurrentLine();
        }
    }

    private _presentBonusStep(): void {
        this._clearLineVisuals();
        const vfxFrames = getWinVfxFrames();

        for (let reel = 0; reel < REEL_COUNT; reel++) {
            const winRows = new Set<number>();
            const vfxRows = new Set<number>();
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                if (this._bonusWildPositions.has(`${reel},${row}`)) {
                    winRows.add(row);
                    vfxRows.add(row);
                }
            }
            this._reels[reel].setCelebration(winRows, vfxRows, this._vfxLayer, vfxFrames);
        }
    }

    private _clearLineVisuals(): void {
        for (const reel of this._reels) {
            reel.clearCelebration();
        }
        this._vfxLayer.removeChildren();
    }

    private _onBonusDismiss = (): void => {
        this._removeBonusDismissListeners();
        this.clear();
        this.onBonusDismissed?.();
    };

    private _addBonusDismissListeners(): void {
        window.addEventListener('keydown', this._onBonusDismiss);
        window.addEventListener('pointerdown', this._onBonusDismiss);
    }

    private _removeBonusDismissListeners(): void {
        window.removeEventListener('keydown', this._onBonusDismiss);
        window.removeEventListener('pointerdown', this._onBonusDismiss);
    }
}
