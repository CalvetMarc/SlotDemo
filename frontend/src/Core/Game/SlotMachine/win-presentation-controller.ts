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

export interface LineWinInfo {
    lineIndex: number;
    payout: number;
    totalWin: number;
    isWildBonus?: boolean;
    isBonusPay?: boolean;
    isBonusEntry?: boolean;
}

export class WinPresentationController {
    private _reels: readonly Reel[];
    private _reelContainer: Container;

    private _vfxLayer!: Container;
    private _pendingLineWins: LineWin[] = [];
    private _currentLineIndex = 0;
    private _linePauseElapsed = -1;

    private _isBonusPending = false;
    private _singleCycle = false;
    private _isWildCelebration = false;
    private _pendingResult: SpinResultWithWins | null = null;
    private _wildSource: SpinResultWithWins | null = null;
    private _chainSource: SpinResultWithWins | null = null;

    private static readonly _LINE_PAUSE_MS = 800;

    private _totalWin = 0;

    public onBonusDismissed?: () => void;
    public onLinePresented?: (info: LineWinInfo) => void;
    public onPresentationCleared?: () => void;

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

    setupBonusDismiss(): void {
        this._isBonusPending = true;
        this._addBonusDismissListeners();
    }

    showWildCelebration(result: SpinResultWithWins, chainResult?: SpinResultWithWins): void {
        this._clearLineVisuals();
        this._isWildCelebration = true;
        this._pendingResult = chainResult ?? null;
        this._wildSource = chainResult ? result : null;
        this._chainSource = chainResult ?? null;
        const vfxFrames = getWinVfxFrames();

        for (let reel = 0; reel < REEL_COUNT; reel++) {
            const winRows = new Set<number>();
            const vfxRows = new Set<number>();
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                if (result.grid[reel][row] === 'Wild_01.png') {
                    winRows.add(row);
                    vfxRows.add(row);
                }
            }
            this._reels[reel].setCelebration(winRows, vfxRows, this._vfxLayer, vfxFrames, true);
        }

        if (result.wildPay > 0) {
            const totalWin = chainResult?.winAmount ?? result.winAmount;
            this.onLinePresented?.({
                lineIndex: -1,
                payout: result.wildPay,
                totalWin,
                isWildBonus: true,
            });
        }
    }

    set singleCycle(value: boolean) {
        this._singleCycle = value;
    }

    show(result: SpinResultWithWins): void {
        if (this._reels[0].isCelebrating || !this._reels[0].isIdle) return;

        for (const reel of this._reels) reel.clearWildPop();

        this._pendingLineWins = result.lineWins;
        this._currentLineIndex = 0;
        this._totalWin = result.winAmount;

        if (this._pendingLineWins.length > 0) {
            this._presentCurrentLine();
        }
    }

    update(deltaMs: number): void {
        if (this._pendingLineWins.length === 0 && !this._isWildCelebration) return;

        if (this._linePauseElapsed >= 0) {
            this._linePauseElapsed += deltaMs;
            if (this._linePauseElapsed >= WinPresentationController._LINE_PAUSE_MS) {
                this._linePauseElapsed = -1;

                // Wild celebration finished — chain into line cycling
                if (this._pendingResult) {
                    const result = this._pendingResult;
                    this._pendingResult = null;
                    this._isWildCelebration = false;
                    this._pendingLineWins = result.lineWins;
                    this._currentLineIndex = 0;
                    this._totalWin = result.winAmount;
                    if (this._pendingLineWins.length > 0) {
                        this._presentCurrentLine();
                    }
                } else if (this._pendingLineWins.length > 1) {
                    this._advanceStep();
                } else if (this._singleCycle) {
                    this.clear();
                    return;
                } else if (this._wildSource) {
                    // Single line win with wilds: replay wild → line cycle
                    this.showWildCelebration(this._wildSource, this._chainSource!);
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
        this._pendingResult = null;
        this._wildSource = null;
        this._chainSource = null;
        this._currentLineIndex = 0;
        this._linePauseElapsed = -1;
        this._singleCycle = false;
        this._isWildCelebration = false;
        this._isBonusPending = false;
        this._totalWin = 0;
        this._removeBonusDismissListeners();
        this.onPresentationCleared?.();
    }

    dispose(): void {
        this.clear();
    }

    private _presentCurrentLine(): void {
        this._clearLineVisuals();

        const lw = this._pendingLineWins[this._currentLineIndex];
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

        this.onLinePresented?.({
            lineIndex: lw.lineIndex,
            payout: lw.payout,
            totalWin: this._totalWin,
        });
    }

    private _advanceStep(): void {
        const nextIndex = (this._currentLineIndex + 1) % this._pendingLineWins.length;

        // Single cycle mode: clear after one full pass
        if (this._singleCycle && nextIndex === 0) {
            this.clear();
            return;
        }

        // Wrap around: replay wild celebration before restarting lines
        if (nextIndex === 0 && this._wildSource) {
            this.showWildCelebration(this._wildSource, this._chainSource!);
            return;
        }

        this._currentLineIndex = nextIndex;
        this._presentCurrentLine();
    }

    private _clearLineVisuals(): void {
        for (const reel of this._reels) {
            reel.clearCelebration();
        }
        this._vfxLayer.removeChildren();
    }

    private _onBonusDismiss = (): void => {
        this._removeBonusDismissListeners();
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
