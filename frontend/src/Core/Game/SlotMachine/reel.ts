import { Container, Sprite, Assets, Spritesheet, ColorMatrixFilter, type Texture } from 'pixi.js';
import {
    CELL_SIZE, SYMBOL_SIZE, VISIBLE_ROWS,
    SPIN_SPEED, OVERSHOOT_PX, BOUNCE_DURATION,
    ANTICIPATION_PX, ANTICIPATION_MS,
    SYMBOL_IDS, SymbolId,
} from './slot-config';
import { SymbolView } from './symbol-view';
import { easeOutQuad, easeOutQuartic } from '../../Animation/easing';
import { evalKeyframes, type Keyframe } from '../../Animation/keyframe-lerp';

type ReelState = 'idle' | 'anticipating' | 'spinning' | 'stopping';

const LANDING_MS = 200;
const TENSION_DIM_BRIGHTNESS = 0.2;
const TENSION_DIM_FADE_MS = 80;

// ── Wild landing pop: grow on land, shrink when all reels stop ──

const WILD_ID: SymbolId = 'Wild_01.png';
const WILD_POP_SCALE = 1.25;
const WILD_POP_SHRINK_MS = 200;

// Elastic grow: slow build-up → explosive release → spring overshoot → settle
const WILD_POP_GROW_KEYFRAMES: readonly Keyframe[] = [
    { time: 0,   value: 1.0 },
    { time: 80,  value: 0.96 },   // squeeze (building tension)
    { time: 120, value: 0.94 },   // max squeeze
    { time: 160, value: 1.35 },   // explosive release, overshoots
    { time: 230, value: 1.16 },   // spring back
    { time: 290, value: 1.30 },   // second overshoot
    { time: 340, value: 1.22 },   // spring back
    { time: 380, value: 1.25 },   // settle at target
];
export const WILD_POP_GROW_MS = WILD_POP_GROW_KEYFRAMES[WILD_POP_GROW_KEYFRAMES.length - 1].time;

type WildPopPhase = 'growing' | 'holding' | 'shrinking';

interface WildPop {
    sprite: Sprite;
    baseScaleX: number;
    baseScaleY: number;
    phase: WildPopPhase;
    elapsed: number;
}

/**
 * A single vertical reel.
 * Holds (VISIBLE_ROWS + 2) symbol sprites that scroll downward.
 * When a sprite leaves the bottom edge it's recycled to the top.
 */
export class Reel extends Container {
    readonly index: number;

    private _symbols: Sprite[] = [];
    private _symbolIds: SymbolId[] = [];
    private _state: ReelState = 'idle';

    // Celebration
    private _celebrationViews: SymbolView[] = [];

    // Wild landing pop
    private _wildPops: WildPop[] = [];

    // Tension dim
    private _dimFilter: ColorMatrixFilter | null = null;
    private _dimTarget = 0;
    private _dimAmount = 0;
    private _isDimAnimating = false;

    /** Total sprites = visible rows + 1 top buffer + 1 bottom buffer. */
    private readonly _totalSlots = VISIBLE_ROWS + 2;

    private _speed = 0;
    private _phaseElapsed = 0;

    // Anticipation — pull up before spinning
    private _anticipationStartY: number[] = [];

    // Stopping — 3 phases: placing → landing → bounce
    private _stopQueue: SymbolId[] = [];
    private _stopQueueIndex = 0;
    private _isLanding = false;
    private _isOvershooting = false;

    // Captured once at start of landing for smooth lerp
    private _sortedForLanding: Sprite[] = [];
    private _landingFromY: number[] = [];

    private _sheet!: Spritesheet;

    /** Callback invoked once this reel has fully settled after stopping. */
    public onSettled?: () => void;

    constructor(index: number) {
        super();
        this.index = index;
        this._sheet = Assets.get('symbols_static');
        this._createSymbols();
    }

    /** Place initial symbols on the reel. */
    setSymbols(symbols: SymbolId[]): void {
        for (let i = 0; i < VISIBLE_ROWS; i++) {
            const sprite = this._symbols[i + 1]; // +1 to skip top buffer
            this._setTexture(sprite, symbols[i]);
        }
        this._setTexture(this._symbols[0], this._randomSymbol());
        this._setTexture(this._symbols[this._totalSlots - 1], this._randomSymbol());
    }

    startSpin(): void {
        this._state = 'anticipating';
        this._phaseElapsed = 0;
        this._anticipationStartY = this._symbols.map(s => s.y);
    }

    /**
     * Begin stop sequence. Target symbols are queued and scroll in
     * naturally from the top as sprites recycle, then the reel eases
     * into the overshoot position and bounces back.
     *
     * Recycle order (bottom-most exits first, placed at top):
     *   queue[0] → ends at bottom buffer
     *   queue[1] → visible row 2
     *   queue[2] → visible row 1
     *   queue[3] → visible row 0
     *   queue[4] → top buffer
     */
    /** Immediately place target symbols and snap to final positions. Skips all animation. */
    forceStop(symbols: SymbolId[]): void {
        this.setSymbols(symbols);
        this._snapPositions();

        this._state = 'idle';
        this._speed = 0;
        this._stopQueue = [];
        this._stopQueueIndex = 0;
        this._isLanding = false;
        this._isOvershooting = false;
        this._phaseElapsed = 0;
        this._anticipationStartY = [];
        this._sortedForLanding = [];
        this._landingFromY = [];
    }

    stopAt(symbols: SymbolId[]): void {
        this._state = 'stopping';
        this._stopQueue = [
            this._randomSymbol(),
            symbols[2],
            symbols[1],
            symbols[0],
            this._randomSymbol(),
        ];
        this._stopQueueIndex = 0;
        this._isLanding = false;
        this._isOvershooting = false;
        this._phaseElapsed = 0;
    }

    update(dt: number): void {
        if (this._isDimAnimating) this._updateDim(dt * 16.67);

        if (this._state === 'idle') return;

        const ms = dt * 16.67;

        // ── Anticipation: rubber-band pull up (fast start, decelerates) ──
        if (this._state === 'anticipating') {
            this._phaseElapsed += ms;
            const t = Math.min(this._phaseElapsed / ANTICIPATION_MS, 1);
            const ease = easeOutQuartic(t);

            for (let i = 0; i < this._symbols.length; i++) {
                this._symbols[i].y = this._anticipationStartY[i] - ANTICIPATION_PX * ease;
            }

            if (t >= 1) {
                // Restore positions and start spinning — fast ramp
                for (let i = 0; i < this._symbols.length; i++) {
                    this._symbols[i].y = this._anticipationStartY[i];
                }
                this._anticipationStartY = [];
                this._state = 'spinning';
                this._speed = SPIN_SPEED * 0.4;
            }
            return;
        }

        // ── Spinning ────────────────────────────────────────────
        if (this._state === 'spinning') {
            if (this._speed < SPIN_SPEED) {
                this._speed = Math.min(this._speed * 1.25, SPIN_SPEED);
            }
            this._moveDown(this._speed * dt);
            return;
        }

        // ── Stopping ────────────────────────────────────────────

        if (!this._isLanding && !this._isOvershooting) {
            // Phase 1 — Placing: keep spinning while target symbols
            // scroll in via the recycle queue.
            this._moveDown(this._speed * dt);

            if (this._stopQueueIndex >= this._stopQueue.length) {
                this._sortedForLanding = [...this._symbols].sort((a, b) => a.y - b.y);
                this._landingFromY = this._sortedForLanding.map(s => s.y);
                this._isLanding = true;
                this._phaseElapsed = 0;
            }
            return;
        }

        if (this._isLanding && !this._isOvershooting) {
            // Phase 2 — Landing: ease from current position to (snap + overshoot).
            this._phaseElapsed += ms;
            const t = Math.min(this._phaseElapsed / LANDING_MS, 1);
            const ease = easeOutQuad(t);

            for (let i = 0; i < this._sortedForLanding.length; i++) {
                const snapY = (i - 1) * CELL_SIZE + CELL_SIZE * 0.5;
                const overshootY = snapY + OVERSHOOT_PX;
                this._sortedForLanding[i].y =
                    this._landingFromY[i] + (overshootY - this._landingFromY[i]) * ease;
            }

            if (t >= 1) {
                this._isOvershooting = true;
                this._phaseElapsed = 0;
            }
            return;
        }

        // Phase 3 — Bounce: ease from overshoot back to snap.
        this._phaseElapsed += ms;
        const t = Math.min(this._phaseElapsed / BOUNCE_DURATION, 1);
        const ease = easeOutQuad(t);

        for (let i = 0; i < this._sortedForLanding.length; i++) {
            const snapY = (i - 1) * CELL_SIZE + CELL_SIZE * 0.5;
            const overshootY = snapY + OVERSHOOT_PX;
            this._sortedForLanding[i].y = overshootY + (snapY - overshootY) * ease;
        }

        if (t >= 1) {
            this._snapPositions();
            this._state = 'idle';
            this._speed = 0;
            this._sortedForLanding = [];
            this._landingFromY = [];
            this.onSettled?.();
        }
    }

    get isIdle(): boolean {
        return this._state === 'idle';
    }

    /** Get the sprite at a visible row (0 = top, 2 = bottom). */
    getVisibleSymbol(row: number): Sprite {
        const sorted = [...this._symbols].sort((a, b) => a.y - b.y);
        return sorted[row + 1]; // +1 to skip top buffer
    }

    /** Get the symbol ID at a visible row (0 = top, 2 = bottom). */
    getSymbolId(row: number): SymbolId {
        const sprite = this.getVisibleSymbol(row);
        const idx = this._symbols.indexOf(sprite);
        return this._symbolIds[idx];
    }

    // ── Celebration ─────────────────────────────────────────────

    /** Set up celebration visuals for this reel's symbols. */
    setCelebration(winRows: Set<number>, vfxRows: Set<number>, vfxLayer: Container, vfxFrames: Texture[]): void {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            const sprite = this.getVisibleSymbol(row);
            const symbolId = this.getSymbolId(row);
            const sv = new SymbolView(this.index, row, symbolId, sprite);

            if (winRows.has(row)) {
                sv.showWinAnimation(this);
            } else {
                sv.dim();
            }

            if (vfxRows.has(row)) {
                sv.showVfx(vfxLayer, vfxFrames);
            }

            this._celebrationViews.push(sv);
        }
    }

    /** Update all celebration views. Returns true when all animated symbols are done. */
    updateCelebration(deltaMs: number): boolean {
        let allAnimatedDone = true;
        for (const sv of this._celebrationViews) {
            const done = sv.update(deltaMs);
            if (sv.hasAnimation && !done) {
                allAnimatedDone = false;
            }
        }
        return allAnimatedDone;
    }

    /** Restart all celebration views for looping. */
    restartCelebration(): void {
        for (const sv of this._celebrationViews) {
            sv.restart();
        }
    }

    /** Clear all celebration visuals. */
    clearCelebration(): void {
        for (const sv of this._celebrationViews) {
            sv.clear();
        }
        this._celebrationViews.length = 0;
    }

    get isCelebrating(): boolean {
        return this._celebrationViews.length > 0;
    }

    get hasWildPops(): boolean {
        return this._wildPops.length > 0;
    }

    // ── Tension dim ───────────────────────────────────────────────

    setDim(dimmed: boolean): void {
        this._dimTarget = dimmed ? 1 : 0;
        this._isDimAnimating = true;
        if (!this._dimFilter) {
            this._dimFilter = new ColorMatrixFilter();
        }
    }

    private _updateDim(ms: number): void {
        const speed = ms / TENSION_DIM_FADE_MS;
        if (this._dimTarget === 1) {
            this._dimAmount = Math.min(this._dimAmount + speed, 1);
        } else {
            this._dimAmount = Math.max(this._dimAmount - speed, 0);
        }

        if (this._dimAmount === this._dimTarget) {
            this._isDimAnimating = false;
        }

        // Celebrations manage their own per-symbol filters — don't overwrite them
        if (this.isCelebrating) return;

        if (this._dimAmount > 0) {
            const brightness = 1.0 + (TENSION_DIM_BRIGHTNESS - 1.0) * this._dimAmount;
            this._dimFilter!.brightness(brightness, false);
            const exemptWilds = this._state === 'idle';
            for (let i = 0; i < this._symbols.length; i++) {
                this._symbols[i].filters = (exemptWilds && this._symbolIds[i] === WILD_ID)
                    ? []
                    : [this._dimFilter!];
            }
        } else {
            for (const sprite of this._symbols) {
                sprite.filters = [];
            }
        }
    }

    // ── Wild landing pop ───────────────────────────────────────────

    /** Grow any visible Wild symbols when this reel lands. */
    startWildPop(): void {
        for (let row = 0; row < VISIBLE_ROWS; row++) {
            if (this.getSymbolId(row) === WILD_ID) {
                const sprite = this.getVisibleSymbol(row);
                this._wildPops.push({
                    sprite,
                    baseScaleX: sprite.scale.x,
                    baseScaleY: sprite.scale.y,
                    phase: 'growing',
                    elapsed: 0,
                });
            }
        }
    }

    /** Trigger shrink back to normal (called when all reels have stopped). */
    shrinkWildPop(): void {
        for (const pop of this._wildPops) {
            if (pop.phase !== 'shrinking') {
                pop.phase = 'shrinking';
                pop.elapsed = 0;
            }
        }
    }

    /** Advance wild pop animations. Auto-clears when all shrinks complete. */
    updateWildPop(deltaMs: number): void {
        if (this._wildPops.length === 0) return;

        let allDone = true;
        for (const pop of this._wildPops) {
            pop.elapsed += deltaMs;
            if (pop.phase === 'growing') {
                const s = evalKeyframes(WILD_POP_GROW_KEYFRAMES, pop.elapsed);
                pop.sprite.scale.set(pop.baseScaleX * s, pop.baseScaleY * s);
                if (pop.elapsed >= WILD_POP_GROW_MS) pop.phase = 'holding';
                allDone = false;
            } else if (pop.phase === 'holding') {
                allDone = false;
            } else {
                const t = Math.min(pop.elapsed / WILD_POP_SHRINK_MS, 1);
                const s = WILD_POP_SCALE + (1 - WILD_POP_SCALE) * easeOutQuad(t);
                pop.sprite.scale.set(pop.baseScaleX * s, pop.baseScaleY * s);
                if (t < 1) allDone = false;
            }
        }

        if (allDone) {
            for (const pop of this._wildPops) {
                pop.sprite.scale.set(pop.baseScaleX, pop.baseScaleY);
            }
            this._wildPops.length = 0;
        }
    }

    /** Immediately clear all wild pops and restore scale. */
    clearWildPop(): void {
        for (const pop of this._wildPops) {
            pop.sprite.scale.set(pop.baseScaleX, pop.baseScaleY);
        }
        this._wildPops.length = 0;
    }

    // ── Private ──────────────────────────────────────────────────

    private _createSymbols(): void {
        for (let i = 0; i < this._totalSlots; i++) {
            const sprite = new Sprite();
            sprite.anchor.set(0.5);
            const id = this._randomSymbol();
            sprite.y = (i - 1) * CELL_SIZE + CELL_SIZE * 0.5;
            sprite.x = CELL_SIZE * 0.5;
            this.addChild(sprite);
            this._symbols.push(sprite);
            this._symbolIds.push(id);
            this._setTexture(sprite, id);
        }
    }

    /** Assign a new texture and scale uniformly to fit within SYMBOL_SIZE. */
    private _setTexture(sprite: Sprite, symbolId: SymbolId): void {
        sprite.texture = this._sheet.textures[symbolId];
        const scale = Math.min(SYMBOL_SIZE / sprite.texture.width, SYMBOL_SIZE / sprite.texture.height);
        sprite.scale.set(scale);
        const idx = this._symbols.indexOf(sprite);
        if (idx !== -1) this._symbolIds[idx] = symbolId;
    }

    /** Return the next symbol for a recycled sprite: from queue if stopping, else random. */
    private _nextRecycleSymbol(): SymbolId {
        if (this._stopQueueIndex < this._stopQueue.length) {
            return this._stopQueue[this._stopQueueIndex++];
        }
        return this._randomSymbol();
    }

    private _moveDown(px: number): void {
        const bottomEdge = VISIBLE_ROWS * CELL_SIZE + CELL_SIZE * 0.5;

        for (const sprite of this._symbols) {
            sprite.y += px;
        }

        for (const sprite of this._symbols) {
            if (sprite.y > bottomEdge) {
                let minY = Infinity;
                for (const s of this._symbols) {
                    if (s.y < minY) minY = s.y;
                }
                sprite.y = minY - CELL_SIZE;
                this._setTexture(sprite, this._nextRecycleSymbol());
            }
        }
    }

    /** Snap all sprites to exact grid positions. */
    private _snapPositions(): void {
        const sorted = [...this._symbols].sort((a, b) => a.y - b.y);
        for (let i = 0; i < this._totalSlots; i++) {
            sorted[i].y = (i - 1) * CELL_SIZE + CELL_SIZE * 0.5;
        }
    }

    private _randomSymbol(): SymbolId {
        return SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)];
    }
}
