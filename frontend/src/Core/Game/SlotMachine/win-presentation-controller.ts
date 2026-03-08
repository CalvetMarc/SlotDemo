import { Container } from 'pixi.js';
import type { Reel } from './reel';
import type { SpinResultWithWins } from './spin-result-provider';
import type { LineWin } from '@shared/types';
import { REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
import { getWinPositions, getFullPaylinePositions } from './slot-config';
import { getWinVfxFrames } from './symbol-view';
import { AudioManager } from '../../Audio/audio-manager';

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
    isAllWins?: boolean;
    isFirstCycle?: boolean;
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
    private _wildSource: SpinResultWithWins | null = null;
    private _chainSource: SpinResultWithWins | null = null;

    private _isFirstCycle = true;
    private _isShowingAll = false;
    private _isShowingWilds = false;

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

    /** Standalone wild celebration — only for bonus entry (no cycling). */
    showWildCelebration(result: SpinResultWithWins): void {
        this._clearLineVisuals();
        this._isWildCelebration = true;
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
    }

    set singleCycle(value: boolean) {
        this._singleCycle = value;
    }

    show(result: SpinResultWithWins, wildResult?: SpinResultWithWins): void {
        console.log('[WPC.show] guard:', { celebrating: this._reels[0].isCelebrating, idle: this._reels[0].isIdle });
        if (this._reels[0].isCelebrating || !this._reels[0].isIdle) {
            console.log('[WPC.show] EARLY RETURN — reels not ready');
            return;
        }
        console.log('[WPC.show] started', { totalWin: result.winAmount, lines: result.lineWins.length, wilds: wildResult?.wildCount });

        for (const reel of this._reels) reel.clearWildPop();

        this._pendingLineWins = result.lineWins;
        this._currentLineIndex = 0;
        this._totalWin = result.winAmount;
        this._isFirstCycle = true;
        this._wildSource = (wildResult && wildResult.wildCount >= 3) ? wildResult : null;
        this._chainSource = this._wildSource ? result : null;

        if (this._pendingLineWins.length > 0 || this._wildSource) {
            this._presentAllWins();
        }
    }

    update(deltaMs: number): void {
        if (this._pendingLineWins.length === 0 && !this._isWildCelebration && !this._isShowingWilds && !this._isShowingAll) return;

        if (this._linePauseElapsed >= 0) {
            this._linePauseElapsed += deltaMs;
            if (this._linePauseElapsed >= WinPresentationController._LINE_PAUSE_MS) {
                this._linePauseElapsed = -1;

                if (this._isShowingAll) {
                    // All-wins phase done → wilds → individual lines → loop
                    this._isShowingAll = false;
                    if (this._wildSource) {
                        console.log('[WPC] showAll done → wildStep (wildCount:', this._wildSource.wildCount, ')');
                        this._presentWildStep();
                    } else if (this._pendingLineWins.length > 0) {
                        console.log('[WPC] showAll done → line 0');
                        this._currentLineIndex = 0;
                        this._presentCurrentLine();
                    } else {
                        console.log('[WPC] showAll done → loop (no wilds, no lines)');
                        this._isFirstCycle = false;
                        this._presentAllWins();
                    }
                } else if (this._isShowingWilds) {
                    // Wild step done → individual lines, or loop back to total
                    this._isShowingWilds = false;
                    if (this._pendingLineWins.length > 0) {
                        console.log('[WPC] wildStep done → line 0');
                        this._currentLineIndex = 0;
                        this._presentCurrentLine();
                    } else {
                        console.log('[WPC] wildStep done → loop (no lines)');
                        this._isFirstCycle = false;
                        this._presentAllWins();
                    }
                } else if (this._pendingLineWins.length > 1) {
                    console.log('[WPC] line done → advanceStep (idx:', this._currentLineIndex, ')');
                    this._advanceStep();
                } else if (this._singleCycle) {
                    console.log('[WPC] singleLine done → singleCycle clear');
                    this.clear();
                    return;
                } else if (this._isWildCelebration) {
                    // Standalone wild celebration done (bonus entry) — stop
                    console.log('[WPC] wildCelebration done (bonus entry)');
                    this._isWildCelebration = false;
                } else {
                    // Loop: show all wins again
                    console.log('[WPC] line done → loop to allWins');
                    this._isFirstCycle = false;
                    this._presentAllWins();
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
        this._wildSource = null;
        this._chainSource = null;
        this._currentLineIndex = 0;
        this._linePauseElapsed = -1;
        this._singleCycle = false;
        this._isWildCelebration = false;
        this._isShowingAll = false;
        this._isShowingWilds = false;
        this._isFirstCycle = true;
        this._isBonusPending = false;
        this._totalWin = 0;
        this._removeBonusDismissListeners();
        this.onPresentationCleared?.();
    }

    dispose(): void {
        this.clear();
        this._vfxLayer.destroy({ children: true });
    }

    private _presentAllWins(): void {
        this._clearLineVisuals();
        this._isShowingAll = true;

        const allWinPositions = getWinPositions(this._pendingLineWins);

        // Include wild positions so they animate in the "total" display
        if (this._wildSource) {
            for (let reel = 0; reel < REEL_COUNT; reel++) {
                for (let row = 0; row < VISIBLE_ROWS; row++) {
                    if (this._wildSource.grid[reel][row] === 'Wild_01.png') {
                        allWinPositions.add(`${reel},${row}`);
                    }
                }
            }
        }

        const vfxFrames = getWinVfxFrames();

        for (let reel = 0; reel < REEL_COUNT; reel++) {
            const winRows = new Set<number>();
            const vfxRows = new Set<number>();
            const goldRows = new Set<number>();
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                const key = `${reel},${row}`;
                if (allWinPositions.has(key)) {
                    winRows.add(row);
                    vfxRows.add(row);
                }
                if (this._wildSource?.grid[reel][row] === 'Wild_01.png') {
                    goldRows.add(row);
                }
            }
            this._reels[reel].setCelebration(winRows, vfxRows, this._vfxLayer, vfxFrames, goldRows);
        }

        AudioManager.play('totalWin');
        if (this._wildSource) {
            AudioManager.play('bonusRoundAnnounce');
        }

        this.onLinePresented?.({
            lineIndex: -1,
            payout: this._totalWin,
            totalWin: this._totalWin,
            isAllWins: true,
            isFirstCycle: this._isFirstCycle,
        });
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

        AudioManager.play('normalWin');

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

        // Wrap around: loop back to all-wins (wilds are shown earlier in cycle)
        if (nextIndex === 0) {
            this._isFirstCycle = false;
            this._presentAllWins();
            return;
        }

        this._currentLineIndex = nextIndex;
        this._presentCurrentLine();
    }

    private _presentWildStep(): void {
        this._clearLineVisuals();
        this._isShowingWilds = true;

        const source = this._wildSource!;
        const vfxFrames = getWinVfxFrames();

        for (let reel = 0; reel < REEL_COUNT; reel++) {
            const winRows = new Set<number>();
            const vfxRows = new Set<number>();
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                if (source.grid[reel][row] === 'Wild_01.png') {
                    winRows.add(row);
                    vfxRows.add(row);
                }
            }
            this._reels[reel].setCelebration(winRows, vfxRows, this._vfxLayer, vfxFrames, true);
        }

        AudioManager.play('wildWin');

        const totalWin = this._chainSource?.winAmount ?? source.winAmount;
        this.onLinePresented?.({
            lineIndex: -1,
            payout: source.wildPay,
            totalWin,
            isWildBonus: true,
        });
    }

    private _clearLineVisuals(): void {
        for (const reel of this._reels) {
            reel.clearCelebration();
        }
        for (const child of this._vfxLayer.children) {
            child.destroy();
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
