import { Sprite, Container, Graphics, Ticker, Text, TextStyle, Assets } from 'pixi.js';
import { View, bundle } from '../../../../Abstractions/view';
import { Reel, WILD_POP_GROW_MS } from '../../../SlotMachine/reel';
import {
    RemoteSpinResultProvider,
    SpinResultWithWins,
} from '../../../SlotMachine/spin-result-provider';
import { gameSignals } from '../../../../Signals/game-signals';
import type { SymbolId } from '@shared/types';
import { SYMBOL_IDS, REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
import {
    CELL_SIZE, GRID_WIDTH, GRID_HEIGHT, PAYLINES,
    SPIN_MIN_DURATION, REEL_START_INTERVAL, REEL_STOP_INTERVAL,
    WILD_TENSION_MULTIPLIERS,
    getWinPositions, getFullPaylinePositions,
} from '../../../SlotMachine/slot-config';
import { ScreenManager } from '../../../../Managers/screen-manager';
import { SessionManager } from '../../../SlotMachine/session-manager';
import { getWinVfxFrames } from '../../../SlotMachine/symbol-view';

export class SlotMachineView extends View {
    private _frameBackground!: Sprite;
    private _frame!: Sprite;
    private _reelContainer!: Container;
    private _reelMask!: Graphics;
    private _vfxLayer!: Container;
    private _reels: Reel[] = [];
    private _resultProvider!: RemoteSpinResultProvider;
    private _isSpinning = false;
    private _currentBetAmount = 2;
    private _unsubscribeSpin?: () => void;
    private _unsubscribeBet?: () => void;
    private _stopTimeouts: ReturnType<typeof setTimeout>[] = [];
    private _wildShrinkTimeout?: ReturnType<typeof setTimeout>;
    private _winPresentationTimeout?: ReturnType<typeof setTimeout>;
    private _debugWinText!: Text;
    private _debugWinTimeout?: ReturnType<typeof setTimeout>;
    private _forcedDebugResult?: SpinResultWithWins;

    // Win presentation – line cycling state
    private _pendingLineWins: import('@shared/types').LineWin[] = [];
    private _currentLineIndex = 0;
    private _linePauseElapsed = -1;

    // Tension spotlight state
    private _isTensionSpin = false;
    private _tensionDimTimeout?: ReturnType<typeof setTimeout>;

    // Bonus celebration state
    private _isBonusPending = false;
    private _hasBonusCelebrationStep = false;
    private _bonusWildPositions = new Set<string>();

    bundleNeeded(): bundle {
        return 'base';
    }

    appear(): void {
        // Always use remote provider — falls back to localhost:3000 if no env var
        this._resultProvider = new RemoteSpinResultProvider();

        // Frame background (behind reels)
        this._frameBackground = Sprite.from('frame_background');
        this._frameBackground.anchor.set(0.5);
        this.addChild(this._frameBackground);

        // Reel container (centered on frame background)
        this._reelContainer = new Container();
        this._reelContainer.x = -GRID_WIDTH * 0.5;
        this._reelContainer.y = -GRID_HEIGHT * 0.5;
        this.addChild(this._reelContainer);

        // Mask to clip symbols to the grid area (expanded to match frame_back)
        const maskPadX = (1736 - GRID_WIDTH) / 2;  // 48
        const maskPadY = (1049 - GRID_HEIGHT) / 2;  // 32.5
        this._reelMask = new Graphics();
        this._reelMask.rect(-maskPadX, -maskPadY, GRID_WIDTH + maskPadX * 2, GRID_HEIGHT + maskPadY * 2);
        this._reelMask.fill({ color: 0xffffff });
        this._reelContainer.addChild(this._reelMask);
        this._reelContainer.mask = this._reelMask;

        // Create reels
        for (let i = 0; i < REEL_COUNT; i++) {
            const reel = new Reel(i);
            reel.x = i * CELL_SIZE;
            this._reelContainer.addChild(reel);
            this._reels.push(reel);
        }

        // VFX layer sits above all reels (still masked by _reelMask)
        this._vfxLayer = new Container();
        this._reelContainer.addChild(this._vfxLayer);

        // Set initial symbols from backend session
        this._setInitialSymbols();

        // Frame overlay (on top of reels)
        this._frame = Sprite.from('frame');
        this._frame.anchor.set(0.5);
        this.addChild(this._frame);

        // Debug win text (provisional)
        this._debugWinText = new Text({
            text: '',
            style: new TextStyle({
                fontFamily: 'Arial',
                fontSize: 48,
                fontWeight: 'bold',
                fill: 0xffd700,
                stroke: { color: 0x000000, width: 5 },
                align: 'center',
            }),
        });
        this._debugWinText.anchor.set(0.5);
        this._debugWinText.y = GRID_HEIGHT * 0.5 + 60;
        this._debugWinText.visible = false;
        this.addChild(this._debugWinText);

        // Listen for signals
        this._unsubscribeSpin = gameSignals.spinPressed.connect(() => this._startSpin());
        this._unsubscribeBet = gameSignals.betChanged.connect(({ amount }) => {
            this._currentBetAmount = amount;
        });
        window.addEventListener('keydown', this._onDebugKeyDown);

        // Hook into shared ticker for reel updates
        Ticker.shared.add(this._onTick, this);
    }

    protected dispose(): void {
        Ticker.shared.remove(this._onTick, this);
        this._unsubscribeSpin?.();
        this._unsubscribeBet?.();
        window.removeEventListener('keydown', this._onDebugKeyDown);
        this._removeBonusDismissListeners();
        this._clearWinPresentation();
        for (const timeout of this._stopTimeouts) {
            clearTimeout(timeout);
        }
        this._stopTimeouts.length = 0;
    }

    private _onTick(ticker: Ticker): void {
        const dt = ticker.deltaTime;
        for (const reel of this._reels) {
            reel.update(dt);
        }

        const deltaMs = dt * 16.67;
        for (const reel of this._reels) {
            reel.updateWildPop(deltaMs);
        }
        this._updateSymbolViews(deltaMs);
    }

    // ── Spin flow ────────────────────────────────────────────────

    private async _startSpin(): Promise<void> {
        if (this._isSpinning) return;
        this._isSpinning = true;

        gameSignals.spinStarted.emit();
        this._clearWinPresentation();
        for (const reel of this._reels) reel.setDim(false);
        this._debugWinText.visible = false;
        if (this._debugWinTimeout) {
            clearTimeout(this._debugWinTimeout);
            this._debugWinTimeout = undefined;
        }

        // Start reel animations immediately (responsive feel)
        for (let i = 0; i < REEL_COUNT; i++) {
            const timeout = setTimeout(() => {
                this._reels[i].startSpin();
            }, i * REEL_START_INTERVAL);
            this._stopTimeouts.push(timeout);
        }

        // Fetch result from backend while reels spin
        let result: SpinResultWithWins;
        if (this._forcedDebugResult) {
            result = this._forcedDebugResult;
            this._forcedDebugResult = undefined;
        } else {
            try {
                result = await this._resultProvider.generateResult(this._currentBetAmount);
            } catch (error) {
                console.error('Spin request failed:', error);
                result = this._generateLocalFallback();
            }
        }

        // Schedule stops with the result
        this._scheduleStops(result);
    }

    private _scheduleStops(result: SpinResultWithWins): void {
        let settledCount = 0;
        let cumulativeDelay = SPIN_MIN_DURATION;
        let wildsSoFar = 0;

        // Precompute which gaps have tension (multiplier > 1)
        const hasTensionAfter: boolean[] = [];
        let preWilds = 0;
        for (let i = 0; i < REEL_COUNT; i++) {
            for (const id of result.grid[i]) {
                if (id === 'Wild_01.png') preWilds++;
            }
            const mult = WILD_TENSION_MULTIPLIERS[preWilds] ?? 1;
            hasTensionAfter.push(mult > 1);
        }
        this._isTensionSpin = hasTensionAfter.some(v => v);

        for (let i = 0; i < REEL_COUNT; i++) {
            const delay = cumulativeDelay;
            const timeout = setTimeout(() => {
                this._reels[i].onSettled = () => {
                    this._reels[i].startWildPop();

                    // Spotlight: dim all reels except the next one to stop
                    if (i < REEL_COUNT - 1 && hasTensionAfter[i]) {
                        const applySpotlight = () => {
                            // Guard: don't re-dim if all reels already stopped
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
                        this._onAllReelsStopped(result);
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

    private static readonly _TENSION_DIM_HOLD_MS = 1500;
    private static readonly _TENSION_DIM_EXTRA_MS = 300;

    private _onAllReelsStopped(result: SpinResultWithWins): void {
        const shouldCelebrate = result.winAmount > 0 || result.bonusTriggered;

        // ── Tension dim sequence ─────────────────────────────────────
        let isTension = false;
        if (this._isTensionSpin) {
            isTension = true;
            const lastReel = this._reels[REEL_COUNT - 1];
            const popDelay = lastReel.hasWildPops
                ? WILD_POP_GROW_MS + SlotMachineView._TENSION_DIM_EXTRA_MS
                : 0;

            // Preload celebration assets during the dim hold
            if (shouldCelebrate) Assets.loadBundle('win');

            const dimAllThenRestore = () => {
                for (const reel of this._reels) reel.setDim(true);
                setTimeout(() => {
                    for (const reel of this._reels) reel.shrinkWildPop();
                }, 200);
                this._tensionDimTimeout = setTimeout(() => {
                    // Clear reel-level dim and go straight into celebration
                    // (celebration handles its own per-symbol dimming)
                    for (const reel of this._reels) reel.setDim(false);
                    this._showTensionResult(result);
                    if (shouldCelebrate) {
                        this._showWinPresentation(result).catch(err =>
                            console.error('[WinPresentation] failed:', err),
                        );
                    }
                }, SlotMachineView._TENSION_DIM_HOLD_MS);
            };
            if (popDelay > 0) {
                this._tensionDimTimeout = setTimeout(dimAllThenRestore, popDelay);
            } else {
                dimAllThenRestore();
            }
            this._isTensionSpin = false;
        } else {
            for (const reel of this._reels) reel.setDim(false);
        }

        // ── Non-tension wild shrink ──────────────────────────────────
        if (!isTension) {
            this._wildShrinkTimeout = setTimeout(() => {
                for (const reel of this._reels) reel.shrinkWildPop();
            }, REEL_STOP_INTERVAL * 2);
        }
        this._stopTimeouts.length = 0;
        gameSignals.spinComplete.emit({ grid: result.grid });

        // ── Bonus setup ──────────────────────────────────────────────
        if (result.bonusTriggered) {
            this._isBonusPending = true;
            this._hasBonusCelebrationStep = result.wildCount < 5;
            this._bonusWildPositions.clear();
            for (let reel = 0; reel < REEL_COUNT; reel++) {
                for (let row = 0; row < VISIBLE_ROWS; row++) {
                    if (result.grid[reel][row] === 'Wild_01.png') {
                        this._bonusWildPositions.add(`${reel},${row}`);
                    }
                }
            }
            gameSignals.bonusTriggered.emit({ wildCount: result.wildCount });
            if (!isTension) {
                this._showDebugWin(`BONUS! ${result.wildCount} wilds`);
            }
        }

        // ── Non-tension win presentation ─────────────────────────────
        if (shouldCelebrate && !isTension) {
            const hasWilds = this._reels.some(r => r.hasWildPops);
            if (hasWilds) {
                const delay = REEL_STOP_INTERVAL * 2 + 300;
                this._winPresentationTimeout = setTimeout(() => {
                    if (result.winAmount > 0) {
                        gameSignals.winDetected.emit({
                            winAmount: result.winAmount,
                            lineWins: result.lineWins,
                        });
                        this._showDebugWin(`WIN ${result.winAmount.toFixed(2)}€`);
                    }
                    this._showWinPresentation(result).catch(err =>
                        console.error('[WinPresentation] failed:', err),
                    );
                }, delay);
            } else {
                if (result.winAmount > 0) {
                    gameSignals.winDetected.emit({
                        winAmount: result.winAmount,
                        lineWins: result.lineWins,
                    });
                    this._showDebugWin(`WIN ${result.winAmount.toFixed(2)}€`);
                }
                this._showWinPresentation(result).catch(err =>
                    console.error('[WinPresentation] failed:', err),
                );
            }
        }

        if (!result.bonusTriggered) {
            this._isSpinning = false;
        }
        // If bonus pending → _isSpinning stays true to block further spins
    }

    /** Show result text + signal when tension dim restores. */
    private _showTensionResult(result: SpinResultWithWins): void {
        if (result.winAmount > 0) {
            gameSignals.winDetected.emit({
                winAmount: result.winAmount,
                lineWins: result.lineWins,
            });
            this._showDebugWin(`WIN ${result.winAmount.toFixed(2)}€`);
        } else if (result.bonusTriggered) {
            this._showDebugWin(`BONUS! ${result.wildCount} wilds`);
        }
    }

    private _showDebugWin(message: string): void {
        this._debugWinText.text = message;
        this._debugWinText.visible = true;
        if (this._debugWinTimeout) {
            clearTimeout(this._debugWinTimeout);
            this._debugWinTimeout = undefined;
        }
    }

    // ── Win presentation ────────────────────────────────────────

    private async _showWinPresentation(result: SpinResultWithWins): Promise<void> {
        await Assets.loadBundle('win');

        // Guard: if a new spin started while we were loading, bail out
        if (this._reels[0].isCelebrating || !this._reels[0].isIdle) return;

        // Ensure wild pops are fully resolved before celebration takes over sprites
        for (const reel of this._reels) reel.clearWildPop();

        this._pendingLineWins = result.lineWins;
        this._currentLineIndex = 0;

        // Present first step — bonus (wilds) first if present
        if (this._hasBonusCelebrationStep) {
            this._presentBonusStep();
        } else if (this._pendingLineWins.length > 0) {
            this._presentCurrentLine();
        }

        // Listen for dismiss when bonus is pending
        if (this._isBonusPending) {
            this._addBonusDismissListeners();
        }
    }

    /** Show a single winning line: animate its symbols, dim the rest, spawn VFX. */
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

    /** Advance to the next celebration step (bonus step first, then line wins, wraps around). */
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

    /** Highlight wild positions as a bonus celebration step. */
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

    private static readonly _LINE_PAUSE_MS = 800;

    /** Update celebration state across all reels. */
    private _updateSymbolViews(deltaMs: number): void {
        if (this._pendingLineWins.length === 0 && !this._hasBonusCelebrationStep) return;

        // Pause phase — wait between cycles
        if (this._linePauseElapsed >= 0) {
            this._linePauseElapsed += deltaMs;
            if (this._linePauseElapsed >= SlotMachineView._LINE_PAUSE_MS) {
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

        // Update all reels — check if all animated symbols are done
        let allDone = true;
        for (const reel of this._reels) {
            if (!reel.updateCelebration(deltaMs)) {
                allDone = false;
            }
        }

        if (allDone) {
            this._linePauseElapsed = 0; // start pause
        }
    }

    /** Clears visuals for the current line (keeps cycling state). */
    private _clearLineVisuals(): void {
        for (const reel of this._reels) {
            reel.clearCelebration();
        }

        // Nuke the entire VFX layer and create a fresh one
        this._vfxLayer.destroy({ children: true });
        this._vfxLayer = new Container();
        this._reelContainer.addChild(this._vfxLayer);
    }

    /** Full reset — clears visuals and line cycling state (called on new spin). */
    private _clearWinPresentation(): void {
        if (this._wildShrinkTimeout) {
            clearTimeout(this._wildShrinkTimeout);
            this._wildShrinkTimeout = undefined;
        }
        if (this._winPresentationTimeout) {
            clearTimeout(this._winPresentationTimeout);
            this._winPresentationTimeout = undefined;
        }
        if (this._tensionDimTimeout) {
            clearTimeout(this._tensionDimTimeout);
            this._tensionDimTimeout = undefined;
        }
        this._isTensionSpin = false;
        for (const reel of this._reels) reel.clearWildPop();
        this._clearLineVisuals();
        this._pendingLineWins = [];
        this._currentLineIndex = 0;
        this._linePauseElapsed = -1;
        this._hasBonusCelebrationStep = false;
        this._bonusWildPositions.clear();
        this._isBonusPending = false;
        this._removeBonusDismissListeners();
    }

    // ── Bonus dismiss ─────────────────────────────────────────────

    private _onBonusDismiss = (): void => {
        this._removeBonusDismissListeners();
        this._clearWinPresentation();
        this._isBonusPending = false;
        ScreenManager.I.transitionMap.BASE();
    };

    private _addBonusDismissListeners(): void {
        window.addEventListener('keydown', this._onBonusDismiss);
        window.addEventListener('pointerdown', this._onBonusDismiss);
    }

    private _removeBonusDismissListeners(): void {
        window.removeEventListener('keydown', this._onBonusDismiss);
        window.removeEventListener('pointerdown', this._onBonusDismiss);
    }

    // ── Helpers ──────────────────────────────────────────────────

    private _setInitialSymbols(): void {
        const grid = SessionManager.consumeInitialGrid();
        console.log('[DEBUG] initialGrid from backend:', grid ? 'YES' : 'NO (fallback)');
        if (grid) {
            console.log('[DEBUG] grid:', JSON.stringify(grid));
            for (let i = 0; i < REEL_COUNT; i++) {
                this._reels[i].setSymbols(grid[i]);
            }
        } else {
            console.warn('[DEBUG] Using random fallback — backend grid not available');
            for (let i = 0; i < REEL_COUNT; i++) {
                const symbols: SymbolId[] = [];
                for (let row = 0; row < VISIBLE_ROWS; row++) {
                    symbols.push(SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)]);
                }
                this._reels[i].setSymbols(symbols);
            }
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
        const wildCount = this._countWilds(grid);
        return { grid, winAmount: 0, lineWins: [], wildCount, bonusTriggered: wildCount >= 3 };
    }

    private _countWilds(grid: SymbolId[][]): number {
        let count = 0;
        for (const reel of grid) {
            for (const id of reel) {
                if (id === 'Wild_01.png') count++;
            }
        }
        return count;
    }

    private _onDebugKeyDown = (event: KeyboardEvent): void => {
        if (event.repeat || this._isSpinning) return;

        const map: Partial<Record<string, { type: 'lineWin'; lineIndex: number; symbol: SymbolId } | { type: 'bonus' } | { type: 'wildLine' }>> = {
            Digit1: { type: 'lineWin', lineIndex: 0, symbol: '1.png' },
            Digit2: { type: 'lineWin', lineIndex: 1, symbol: '2.png' },
            Digit3: { type: 'lineWin', lineIndex: 2, symbol: '3.png' },
            Digit4: { type: 'lineWin', lineIndex: 3, symbol: 'J.png' },
            Digit5: { type: 'lineWin', lineIndex: 4, symbol: 'Q.png' },
            Digit6: { type: 'lineWin', lineIndex: 5, symbol: 'K.png' },
            Digit7: { type: 'lineWin', lineIndex: 6, symbol: 'A.png' },
            Digit8: { type: 'lineWin', lineIndex: 0, symbol: 'Wild_01.png' },
            Digit9: { type: 'bonus' },
            Digit0: { type: 'wildLine' },
        };
        const debugPreset = map[event.code];
        if (!debugPreset) return;

        event.preventDefault();
        if (debugPreset.type === 'wildLine') {
            this._forcedDebugResult = this._createDebugWildLineWin();
        } else {
            this._forcedDebugResult = debugPreset.type === 'bonus'
                ? this._createDebugBonusTrigger()
                : this._createDebugLineWin(debugPreset.lineIndex, debugPreset.symbol);
        }
        this._startSpin().catch(err => console.error('[DebugSpin] failed:', err));
    };

    private _createDebugLineWin(lineIndex: number, symbol: SymbolId): SpinResultWithWins {
        // Diverse filler so no accidental line wins on straight paylines
        const grid: SymbolId[][] = [
            ['J.png', 'Q.png', 'K.png'],
            ['K.png', 'A.png', 'J.png'],
            ['Q.png', 'K.png', 'A.png'],
            ['A.png', 'J.png', 'Q.png'],
            ['K.png', 'Q.png', 'J.png'],
        ];

        const payline = PAYLINES[lineIndex];
        for (let reel = 0; reel < REEL_COUNT; reel++) {
            grid[reel][payline[reel]] = symbol;
        }

        const payout = this._currentBetAmount * 10;
        const wildCount = this._countWilds(grid);
        return {
            grid,
            winAmount: payout,
            lineWins: [{ lineIndex, symbol, count: 5, payout }],
            wildCount,
            bonusTriggered: wildCount >= 3,
        };
    }

    private _createDebugBonusTrigger(): SpinResultWithWins {
        const grid: SymbolId[][] = [
            ['K.png', '1.png', 'Q.png'],
            ['3.png', 'J.png', 'A.png'],
            ['A.png', 'K.png', '2.png'],
            ['J.png', 'Q.png', '3.png'],
            ['2.png', 'A.png', 'K.png'],
        ];

        // 3 wilds in non-aligned positions to avoid accidental line wins.
        grid[0][0] = 'Wild_01.png';
        grid[2][1] = 'Wild_01.png';
        grid[4][2] = 'Wild_01.png';

        const wildCount = this._countWilds(grid);
        return {
            grid,
            winAmount: 0,
            lineWins: [],
            wildCount,
            bonusTriggered: wildCount >= 3,
        };
    }

    /** 3 wilds (reels 0, 1, 2) + King line win on middle payline. */
    private _createDebugWildLineWin(): SpinResultWithWins {
        const grid: SymbolId[][] = [
            ['Wild_01.png', '1.png', 'J.png'],
            ['Q.png', '1.png', 'Wild_01.png'],
            ['Wild_01.png', '1.png', 'K.png'],
            ['A.png', '1.png', 'Q.png'],
            ['K.png', '1.png', 'J.png'],
        ];

        const payout = this._currentBetAmount * 10;
        const wildCount = this._countWilds(grid);
        return {
            grid,
            winAmount: payout,
            lineWins: [{ lineIndex: 0, symbol: '1.png', count: 5, payout }],
            wildCount,
            bonusTriggered: wildCount >= 3,
        };
    }
}
