import { Sprite, Container, Graphics, Ticker, Text, TextStyle, AnimatedSprite, Assets, ColorMatrixFilter, Spritesheet, Filter } from 'pixi.js';
import { View, bundle } from '../../../../Abstractions/view';
import { Reel } from '../../../SlotMachine/reel';
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
    getWinPositions,
} from '../../../SlotMachine/slot-config';
import { ScreenManager } from '../../../../Managers/screen-manager';
import { SessionManager } from '../../../SlotMachine/session-manager';

/** Maps SymbolId → { asset: bundle asset key, anim: animation key inside the spritesheet }. */
const ANIMATED_SYMBOL_MAP: Partial<Record<SymbolId, { asset: string; anim: string }>> = {
    '1.png':           { asset: 'king_animated',    anim: 'king' },
    '2.png':           { asset: 'queen_animated',   anim: 'queen' },
    '3.png':           { asset: 'wolf_animated',    anim: 'wolf_icon' },
    'J.png':           { asset: 'j_animated',       anim: 'J' },
    'K.png':           { asset: 'k_animated',       anim: 'K' },
    'Q.png':           { asset: 'q_animated',       anim: 'Q' },
    'A.png':           { asset: 'a_animated',       anim: 'A' },
    'Scatter_01.png':  { asset: 'scatter_animated', anim: 'Scatter' },
    'Wild_01.png':     { asset: 'wild_animated',    anim: 'Wild' },
};

const WIN_PULSE_GROW_MS = 280;
const WIN_PULSE_SHRINK_MS = 220;
const WIN_PULSE_PAUSE_MS = 800;
const WIN_SCALE = 1.15;

type WinPulsePhase = 'growing' | 'playing' | 'shrinking' | 'waiting';

type WinPulseState = {
    anim: AnimatedSprite;
    staticSprite: Sprite;
    staticBaseScaleX: number;
    staticBaseScaleY: number;
    animBaseScale: number;
    animRefFrameWidth: number;
    animRefFrameHeight: number;
    elapsedMs: number;
    phase: WinPulsePhase;
    animationFinished: boolean;
};

export class SlotMachineView extends View {
    private _frameBackground!: Sprite;
    private _frame!: Sprite;
    private _reelContainer!: Container;
    private _reelMask!: Graphics;
    private _reels: Reel[] = [];
    private _resultProvider!: RemoteSpinResultProvider;
    private _isSpinning = false;
    private _currentBetAmount = 2;
    private _unsubscribeSpin?: () => void;
    private _unsubscribeBet?: () => void;
    private _stopTimeouts: ReturnType<typeof setTimeout>[] = [];
    private _debugWinText!: Text;
    private _debugWinTimeout?: ReturnType<typeof setTimeout>;
    private _forcedDebugResult?: SpinResultWithWins;

    // Win presentation cleanup state
    private _winAnimSprites: AnimatedSprite[] = [];
    private _winPulseStates: WinPulseState[] = [];
    private _dimmedSprites: { sprite: Sprite; previousFilters: Filter[] | null }[] = [];

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

        // Mask to clip symbols to the grid area
        this._reelMask = new Graphics();
        this._reelMask.rect(0, 0, GRID_WIDTH, GRID_HEIGHT);
        this._reelMask.fill({ color: 0xffffff });
        this._reelContainer.addChild(this._reelMask);
        this._reelContainer.mask = this._reelMask;

        // Create reels
        for (let i = 0; i < REEL_COUNT; i++) {
            const reel = new Reel();
            reel.x = i * CELL_SIZE;
            this._reelContainer.addChild(reel);
            this._reels.push(reel);
        }

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
        this._updateWinPulses(dt * 16.67);
    }

    // ── Spin flow ────────────────────────────────────────────────

    private async _startSpin(): Promise<void> {
        if (this._isSpinning) return;
        this._isSpinning = true;

        gameSignals.spinStarted.emit();
        this._clearWinPresentation();
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

        for (let i = 0; i < REEL_COUNT; i++) {
            const delay = SPIN_MIN_DURATION + i * REEL_STOP_INTERVAL;
            const timeout = setTimeout(() => {
                this._reels[i].onSettled = () => {
                    settledCount++;
                    if (settledCount === REEL_COUNT) {
                        this._onAllReelsStopped(result);
                    }
                };
                this._reels[i].stopAt(result.grid[i]);
            }, delay);
            this._stopTimeouts.push(timeout);
        }
    }

    private _onAllReelsStopped(result: SpinResultWithWins): void {
        this._stopTimeouts.length = 0;
        gameSignals.spinComplete.emit({ grid: result.grid });

        if (result.winAmount > 0) {
            gameSignals.winDetected.emit({
                winAmount: result.winAmount,
                lineWins: result.lineWins,
            });
            this._showDebugWin(`WIN ${result.winAmount.toFixed(2)}€`);
            this._showWinPresentation(result).catch(err =>
                console.error('[WinPresentation] failed:', err),
            );
        }

        if (result.bonusTriggered) {
            // Keep _isSpinning = true to block further spins during transition
            gameSignals.bonusTriggered.emit({ scatterCount: result.scatterCount });
            this._showDebugWin(`BONUS! ${result.scatterCount} scatters`);
            setTimeout(() => {
                ScreenManager.I.transitionMap.BASE();
            }, 1500);
            return;
        }

        this._isSpinning = false;
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
        console.log('[WinPresentation] lineWins:', result.lineWins);
        await Assets.loadBundle('win');
        console.log('[WinPresentation] win bundle loaded');

        // Guard: if a new spin started while we were loading, bail out
        if (this._winAnimSprites.length > 0 || !this._reels[0].isIdle) return;

        const winPositions = getWinPositions(result.lineWins);
        console.log('[WinPresentation] winPositions:', [...winPositions]);

        for (let reel = 0; reel < REEL_COUNT; reel++) {
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                const sprite = this._reels[reel].getVisibleSymbol(row);
                const key = `${reel},${row}`;

                if (winPositions.has(key)) {
                    this._animateWinSymbol(reel, row, sprite);
                } else {
                    this._dimSymbol(sprite);
                }
            }
        }
        console.log('[WinPresentation] animated:', this._winAnimSprites.length, 'dimmed:', this._dimmedSprites.length);
    }

    private _animateWinSymbol(reel: number, row: number, staticSprite: Sprite): void {
        const symbolId = this._reels[reel].getSymbolId(row);
        const mapping = ANIMATED_SYMBOL_MAP[symbolId];
        if (!mapping) {
            console.warn('[WinPresentation] no mapping for', symbolId);
            return;
        }

        const sheet: Spritesheet = Assets.get(mapping.asset);
        if (!sheet) {
            console.warn('[WinPresentation] sheet not found for', mapping.asset);
            return;
        }
        if (!sheet.animations?.[mapping.anim]) {
            console.warn('[WinPresentation] animation not found:', mapping.anim, 'in', mapping.asset, '| available:', Object.keys(sheet.animations ?? {}));
            return;
        }

        const anim = new AnimatedSprite(sheet.animations[mapping.anim]);
        anim.anchor.set(0.5);
        anim.animationSpeed = 0.3;
        anim.loop = false;

        const baseScale = Math.min(Math.abs(staticSprite.scale.x), Math.abs(staticSprite.scale.y));
        const refFrame = anim.texture.frame;

        const applyAnimSize = (scaleMultiplier = 1): void => {
            const frame = anim.texture.frame;
            const frameAdjust = Math.min(
                refFrame.width / frame.width,
                refFrame.height / frame.height,
            );
            anim.scale.set(baseScale * frameAdjust * scaleMultiplier);
        };

        // Position at the same location as the static sprite within its reel
        anim.x = staticSprite.x;
        anim.y = staticSprite.y;
        // Keep overlay size stable even if animation frames have different source sizes.
        applyAnimSize();
        anim.visible = false;
        anim.gotoAndStop(0);

        this._reels[reel].addChild(anim);

        const pulse: WinPulseState = {
            anim,
            staticSprite,
            staticBaseScaleX: staticSprite.scale.x,
            staticBaseScaleY: staticSprite.scale.y,
            animBaseScale: baseScale,
            animRefFrameWidth: refFrame.width,
            animRefFrameHeight: refFrame.height,
            elapsedMs: 0,
            phase: 'growing',
            animationFinished: false,
        };
        anim.onComplete = () => {
            anim.gotoAndStop(0);
            pulse.animationFinished = true;
        };

        this._winAnimSprites.push(anim);
        this._winPulseStates.push(pulse);
    }

    private _updateWinPulses(deltaMs: number): void {
        if (this._winPulseStates.length === 0) return;

        for (const pulse of this._winPulseStates) {
            pulse.elapsedMs += deltaMs;

            if (pulse.phase === 'growing') {
                const t = Math.min(pulse.elapsedMs / WIN_PULSE_GROW_MS, 1);
                pulse.staticSprite.visible = true;
                pulse.anim.visible = false;
                const scaleMul = 1 + (WIN_SCALE - 1) * t;
                pulse.staticSprite.scale.set(
                    pulse.staticBaseScaleX * scaleMul,
                    pulse.staticBaseScaleY * scaleMul,
                );
                if (t >= 1) {
                    pulse.phase = 'playing';
                    pulse.elapsedMs = 0;
                    pulse.animationFinished = false;
                    const frame = pulse.anim.texture.frame;
                    const frameAdjust = Math.min(
                        pulse.animRefFrameWidth / frame.width,
                        pulse.animRefFrameHeight / frame.height,
                    );
                    pulse.anim.scale.set(pulse.animBaseScale * frameAdjust * WIN_SCALE);
                    pulse.staticSprite.visible = false;
                    pulse.anim.visible = true;
                    pulse.anim.gotoAndPlay(0);
                }
                continue;
            }

            if (pulse.phase === 'playing') {
                pulse.staticSprite.visible = false;
                pulse.anim.visible = true;
                const tex = pulse.anim.texture;
                const frame = tex.frame;
                const frameAdjust = Math.min(
                    pulse.animRefFrameWidth / frame.width,
                    pulse.animRefFrameHeight / frame.height,
                );
                const scale = pulse.animBaseScale * frameAdjust * WIN_SCALE;
                pulse.anim.scale.set(scale);
                if (pulse.animationFinished) {
                    pulse.phase = 'shrinking';
                    pulse.elapsedMs = 0;
                    pulse.anim.visible = false;
                    pulse.staticSprite.visible = true;
                }
                continue;
            }

            if (pulse.phase === 'shrinking') {
                const t = Math.min(pulse.elapsedMs / WIN_PULSE_SHRINK_MS, 1);
                pulse.staticSprite.visible = true;
                pulse.anim.visible = false;
                const scaleMul = WIN_SCALE + (1 - WIN_SCALE) * t;
                pulse.staticSprite.scale.set(
                    pulse.staticBaseScaleX * scaleMul,
                    pulse.staticBaseScaleY * scaleMul,
                );
                if (t >= 1) {
                    pulse.phase = 'waiting';
                    pulse.elapsedMs = 0;
                    pulse.staticSprite.scale.set(pulse.staticBaseScaleX, pulse.staticBaseScaleY);
                }
                continue;
            }

            if (pulse.elapsedMs >= WIN_PULSE_PAUSE_MS) {
                pulse.phase = 'growing';
                pulse.elapsedMs = 0;
                pulse.staticSprite.visible = true;
                pulse.anim.visible = false;
                pulse.staticSprite.scale.set(pulse.staticBaseScaleX, pulse.staticBaseScaleY);
            }
        }
    }

    private _dimSymbol(sprite: Sprite): void {
        const filter = new ColorMatrixFilter();
        filter.brightness(0.35, false);
        filter.desaturate();

        const previousFilters = sprite.filters ? [...sprite.filters] : null;
        this._dimmedSprites.push({ sprite, previousFilters });
        sprite.filters = [...(previousFilters ?? []), filter];
    }

    private _clearWinPresentation(): void {
        for (const pulse of this._winPulseStates) {
            pulse.staticSprite.visible = true;
            pulse.staticSprite.scale.set(pulse.staticBaseScaleX, pulse.staticBaseScaleY);
        }
        for (const anim of this._winAnimSprites) {
            anim.stop();
            anim.destroy();
        }
        this._winAnimSprites.length = 0;
        this._winPulseStates.length = 0;

        for (const { sprite, previousFilters } of this._dimmedSprites) {
            sprite.filters = previousFilters;
        }
        this._dimmedSprites.length = 0;
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
        return { grid, winAmount: 0, lineWins: [], scatterCount: 0, bonusTriggered: false };
    }

    private _onDebugKeyDown = (event: KeyboardEvent): void => {
        if (event.repeat || this._isSpinning) return;

        const map: Partial<Record<string, { type: 'lineWin'; lineIndex: number; symbol: SymbolId } | { type: 'bonus' }>> = {
            Digit1: { type: 'lineWin', lineIndex: 0, symbol: '1.png' },
            Digit2: { type: 'lineWin', lineIndex: 1, symbol: '2.png' },
            Digit3: { type: 'lineWin', lineIndex: 2, symbol: '3.png' },
            Digit4: { type: 'lineWin', lineIndex: 3, symbol: 'J.png' },
            Digit5: { type: 'lineWin', lineIndex: 4, symbol: 'Q.png' },
            Digit6: { type: 'lineWin', lineIndex: 5, symbol: 'K.png' },
            Digit7: { type: 'lineWin', lineIndex: 6, symbol: 'A.png' },
            Digit8: { type: 'lineWin', lineIndex: 0, symbol: 'Wild_01.png' },
            Digit9: { type: 'bonus' },
        };
        const debugPreset = map[event.code];
        if (!debugPreset) return;

        event.preventDefault();
        this._forcedDebugResult = debugPreset.type === 'bonus'
            ? this._createDebugBonusTrigger()
            : this._createDebugLineWin(debugPreset.lineIndex, debugPreset.symbol);
        this._startSpin().catch(err => console.error('[DebugSpin] failed:', err));
    };

    private _createDebugLineWin(lineIndex: number, symbol: SymbolId): SpinResultWithWins {
        const grid: SymbolId[][] = [];
        for (let reel = 0; reel < REEL_COUNT; reel++) {
            grid.push(['J.png', 'Q.png', 'K.png']);
        }

        const payline = PAYLINES[lineIndex];
        for (let reel = 0; reel < REEL_COUNT; reel++) {
            grid[reel][payline[reel]] = symbol;
        }

        const payout = this._currentBetAmount * 10;
        return {
            grid,
            winAmount: payout,
            lineWins: [{ lineIndex, symbol, count: 5, payout }],
            scatterCount: 0,
            bonusTriggered: false,
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

        // 3 scatters in non-aligned positions to avoid accidental line wins.
        grid[0][0] = 'Scatter_01.png';
        grid[2][1] = 'Scatter_01.png';
        grid[4][2] = 'Scatter_01.png';

        return {
            grid,
            winAmount: 0,
            lineWins: [],
            scatterCount: 3,
            bonusTriggered: true,
        };
    }
}
