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
    getWinPositions, getFullPaylinePositions,
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

const WIN_VFX_FIRST_FRAME = 2;
const WIN_VFX_LAST_FRAME = 39;
const WIN_VFX_FRAME_SIZE = 350;
const WIN_VFX_FADE_MS = 300;

const WIN_VFX_PAUSE_MS = 1000;

type WinVfxPhase = 'fadingIn' | 'playing' | 'fadingOut' | 'waiting';

type WinVfxState = {
    sprite: AnimatedSprite;
    phase: WinVfxPhase;
    elapsedMs: number;
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
    private _vfxLayer!: Container;
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

    // Win presentation – line cycling state
    private _pendingLineWins: import('@shared/types').LineWin[] = [];
    private _currentLineIndex = 0;
    private _lineCycleComplete = false;

    // Win presentation cleanup state
    private _winAnimSprites: AnimatedSprite[] = [];
    private _winVfxSprites: AnimatedSprite[] = [];
    private _winVfxStates: WinVfxState[] = [];
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
            const reel = new Reel();
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
        this._updateWinVfx(dt * 16.67);
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
        await Assets.loadBundle('win');

        // Guard: if a new spin started while we were loading, bail out
        if (this._winAnimSprites.length > 0 || !this._reels[0].isIdle) return;

        this._pendingLineWins = result.lineWins;
        this._currentLineIndex = 0;
        this._presentCurrentLine();
    }

    /** Show a single winning line: animate its symbols, dim the rest, spawn VFX. */
    private _presentCurrentLine(): void {
        this._clearLineVisuals();
        this._lineCycleComplete = false;

        const lw = this._pendingLineWins[this._currentLineIndex];
        const winPositions = getWinPositions([lw]);
        const fullPositions = getFullPaylinePositions([lw]);

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

        this._spawnWinVfx(fullPositions);
    }

    /** Advance to the next winning line (wraps around). */
    private _advanceLine(): void {
        this._currentLineIndex = (this._currentLineIndex + 1) % this._pendingLineWins.length;
        this._presentCurrentLine();
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
                if (this._pendingLineWins.length > 1 && !this._lineCycleComplete) {
                    // Advance to next line instead of looping the same one
                    this._lineCycleComplete = true;
                    this._advanceLine();
                    return;
                }
                // Single line win — loop the pulse
                pulse.phase = 'growing';
                pulse.elapsedMs = 0;
                pulse.staticSprite.visible = true;
                pulse.anim.visible = false;
                pulse.staticSprite.scale.set(pulse.staticBaseScaleX, pulse.staticBaseScaleY);
            }
        }
    }

    private _spawnWinVfx(positions: Set<string>): void {
        const sheet: Spritesheet | undefined = Assets.get('win_vfx');
        if (!sheet) return;

        const textures = sheet.textures;
        const frames = [];
        for (let i = WIN_VFX_FIRST_FRAME; i <= WIN_VFX_LAST_FRAME; i++) {
            const key = `win_effect_${String(i).padStart(2, '0')}.png`;
            if (textures[key]) frames.push(textures[key]);
        }
        if (frames.length === 0) return;

        for (const posKey of positions) {
            const [reelIdx, rowIdx] = posKey.split(',').map(Number);
            const symbol = this._reels[reelIdx].getVisibleSymbol(rowIdx);

            const vfx = new AnimatedSprite(frames, false);
            vfx.anchor.set(0.5);
            vfx.animationSpeed = 0.25;
            vfx.loop = false;
            vfx.x = reelIdx * CELL_SIZE + symbol.x;
            vfx.y = symbol.y;
            vfx.alpha = 0;
            vfx.scale.set(CELL_SIZE / WIN_VFX_FRAME_SIZE);

            this._vfxLayer.addChild(vfx);
            vfx.gotoAndPlay(0);
            this._winVfxSprites.push(vfx);
            this._winVfxStates.push({ sprite: vfx, phase: 'fadingIn', elapsedMs: 0 });
        }
    }

    private _updateWinVfx(deltaMs: number): void {
        for (const state of this._winVfxStates) {
            const vfx = state.sprite;
            state.elapsedMs += deltaMs;

            // Manually advance frames (autoUpdate is off)
            if (vfx.playing) vfx.update(Ticker.shared);

            // Detect animation end
            if (!vfx.playing && state.phase === 'playing') {
                state.phase = 'fadingOut';
                state.elapsedMs = 0;
            }

            if (state.phase === 'fadingIn') {
                const t = Math.min(state.elapsedMs / WIN_VFX_FADE_MS, 1);
                vfx.alpha = t;
                if (t >= 1) {
                    state.phase = 'playing';
                    state.elapsedMs = 0;
                }
            } else if (state.phase === 'fadingOut') {
                const t = Math.min(state.elapsedMs / WIN_VFX_FADE_MS, 1);
                vfx.alpha = 1 - t;
                if (t >= 1) {
                    vfx.alpha = 0;
                    vfx.visible = false;
                    state.phase = 'waiting';
                    state.elapsedMs = 0;
                }
            } else if (state.phase === 'waiting') {
                if (state.elapsedMs >= WIN_VFX_PAUSE_MS) {
                    vfx.gotoAndPlay(0);
                    vfx.alpha = 0;
                    vfx.visible = true;
                    state.phase = 'fadingIn';
                    state.elapsedMs = 0;
                }
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

    /** Clears visuals for the current line (keeps cycling state). */
    private _clearLineVisuals(): void {
        for (const pulse of this._winPulseStates) {
            pulse.anim.onComplete = undefined;
            pulse.anim.visible = false;
            if (pulse.anim.parent) pulse.anim.parent.removeChild(pulse.anim);
            pulse.anim.stop();
            pulse.anim.destroy();
            pulse.staticSprite.visible = true;
            pulse.staticSprite.scale.set(pulse.staticBaseScaleX, pulse.staticBaseScaleY);
        }
        this._winAnimSprites.length = 0;
        this._winPulseStates.length = 0;

        // Nuke the entire VFX layer and create a fresh one
        this._vfxLayer.destroy({ children: true });
        this._vfxLayer = new Container();
        this._reelContainer.addChild(this._vfxLayer);
        this._winVfxSprites.length = 0;
        this._winVfxStates.length = 0;

        for (const { sprite, previousFilters } of this._dimmedSprites) {
            sprite.filters = previousFilters;
        }
        this._dimmedSprites.length = 0;
    }

    /** Full reset — clears visuals and line cycling state (called on new spin). */
    private _clearWinPresentation(): void {
        this._clearLineVisuals();
        this._pendingLineWins = [];
        this._currentLineIndex = 0;
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

        const map: Partial<Record<string, { type: 'lineWin'; lineIndex: number; symbol: SymbolId } | { type: 'bonus' } | { type: 'multiLine' }>> = {
            Digit1: { type: 'lineWin', lineIndex: 0, symbol: '1.png' },
            Digit2: { type: 'lineWin', lineIndex: 1, symbol: '2.png' },
            Digit3: { type: 'lineWin', lineIndex: 2, symbol: '3.png' },
            Digit4: { type: 'lineWin', lineIndex: 3, symbol: 'J.png' },
            Digit5: { type: 'lineWin', lineIndex: 4, symbol: 'Q.png' },
            Digit6: { type: 'lineWin', lineIndex: 5, symbol: 'K.png' },
            Digit7: { type: 'lineWin', lineIndex: 6, symbol: 'A.png' },
            Digit8: { type: 'lineWin', lineIndex: 0, symbol: 'Wild_01.png' },
            Digit9: { type: 'bonus' },
            Digit0: { type: 'multiLine' },
        };
        const debugPreset = map[event.code];
        if (!debugPreset) return;

        event.preventDefault();
        if (debugPreset.type === 'multiLine') {
            this._forcedDebugResult = this._createDebugMultiLineWin();
        } else {
            this._forcedDebugResult = debugPreset.type === 'bonus'
                ? this._createDebugBonusTrigger()
                : this._createDebugLineWin(debugPreset.lineIndex, debugPreset.symbol);
        }
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

    /** 3 simultaneous line wins: top (Queen), middle (King), bottom (Wolf). */
    private _createDebugMultiLineWin(): SpinResultWithWins {
        const grid: SymbolId[][] = [];
        for (let reel = 0; reel < REEL_COUNT; reel++) {
            grid.push(['2.png', '1.png', '3.png']);
        }

        const payout = this._currentBetAmount * 10;
        return {
            grid,
            winAmount: payout * 3,
            lineWins: [
                { lineIndex: 0, symbol: '1.png', count: 5, payout }, // middle: King
                { lineIndex: 1, symbol: '2.png', count: 5, payout }, // top: Queen
                { lineIndex: 2, symbol: '3.png', count: 5, payout }, // bottom: Wolf
            ],
            scatterCount: 0,
            bonusTriggered: false,
        };
    }
}
