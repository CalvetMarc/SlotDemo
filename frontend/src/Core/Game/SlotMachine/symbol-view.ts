import { Sprite, Container, AnimatedSprite, Assets, ColorMatrixFilter, Spritesheet, Ticker, Filter } from 'pixi.js';
import type { SymbolId } from '@shared/types';
import { CELL_SIZE } from './slot-config';

// ── Animated symbol mapping ──────────────────────────────────────

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

// ── Celebration phase ────────────────────────────────────────────

type CelebrationPhase = 'vfx' | 'pulse' | 'done';

// ── Win pulse constants ──────────────────────────────────────────

const WIN_PULSE_GROW_MS = 280;
const WIN_PULSE_SHRINK_MS = 220;
const WIN_SCALE = 1.15;

type PulseSubPhase = 'growing' | 'playing' | 'shrinking';

// ── Win VFX constants ────────────────────────────────────────────

const WIN_VFX_FIRST_FRAME = 2;
const WIN_VFX_LAST_FRAME = 39;
const WIN_VFX_FRAME_SIZE = 350;
const WIN_VFX_FADE_MS = 220;

type VfxSubPhase = 'fadingIn' | 'playing' | 'fadingOut';

// ── Helper: load VFX frames from spritesheet ─────────────────────

/** Extracts the win VFX animation frames from the 'win_vfx' spritesheet. */
export function getWinVfxFrames(): import('pixi.js').Texture[] {
    const sheet: Spritesheet | undefined = Assets.get('win_vfx');
    if (!sheet) return [];

    const textures = sheet.textures;
    const frames: import('pixi.js').Texture[] = [];
    for (let i = WIN_VFX_FIRST_FRAME; i <= WIN_VFX_LAST_FRAME; i++) {
        const key = `win_effect_${String(i).padStart(2, '0')}.png`;
        if (textures[key]) frames.push(textures[key]);
    }
    return frames;
}

// ── SymbolView ───────────────────────────────────────────────────

/**
 * Encapsulates per-symbol win presentation state: animated overlay,
 * celebration state machine (vfx → pulse → done), VFX sprite, and dim filter.
 *
 * The Reel creates one SymbolView per grid cell during win presentation
 * and delegates all per-symbol visuals to it.
 */
export class SymbolView {
    readonly reel: number;
    readonly row: number;
    readonly symbolId: SymbolId;
    readonly staticSprite: Sprite;

    // Celebration phase
    private _phase: CelebrationPhase = 'vfx';

    // Win animation (pulse)
    private _animSprite?: AnimatedSprite;
    private _pulsePhase: PulseSubPhase = 'growing';
    private _pulseElapsed = 0;
    private _animFinished = false;
    private _staticBaseScaleX: number;
    private _staticBaseScaleY: number;
    private _animBaseScale = 0;
    private _animRefFrameWidth = 0;
    private _animRefFrameHeight = 0;

    // VFX
    private _vfxSprite?: AnimatedSprite;
    private _vfxPhase: VfxSubPhase = 'fadingIn';
    private _vfxElapsed = 0;

    // Dim
    private _dimFilter?: ColorMatrixFilter;
    private _previousFilters: Filter[] | null = null;

    constructor(reel: number, row: number, symbolId: SymbolId, staticSprite: Sprite) {
        this.reel = reel;
        this.row = row;
        this.symbolId = symbolId;
        this.staticSprite = staticSprite;
        this._staticBaseScaleX = staticSprite.scale.x;
        this._staticBaseScaleY = staticSprite.scale.y;
    }

    /** Spawn animated overlay on the reel container and start pulse cycle. */
    showWinAnimation(reelContainer: Container): void {
        const mapping = ANIMATED_SYMBOL_MAP[this.symbolId];
        if (!mapping) {
            console.warn('[SymbolView] no mapping for', this.symbolId);
            return;
        }

        const sheet: Spritesheet = Assets.get(mapping.asset);
        if (!sheet) {
            console.warn('[SymbolView] sheet not found for', mapping.asset);
            return;
        }
        if (!sheet.animations?.[mapping.anim]) {
            console.warn('[SymbolView] animation not found:', mapping.anim, 'in', mapping.asset,
                '| available:', Object.keys(sheet.animations ?? {}));
            return;
        }

        const anim = new AnimatedSprite(sheet.animations[mapping.anim]);
        anim.anchor.set(0.5);
        anim.animationSpeed = 0.3;
        anim.loop = false;

        this._animBaseScale = Math.min(
            Math.abs(this.staticSprite.scale.x),
            Math.abs(this.staticSprite.scale.y),
        );
        const refFrame = anim.texture.frame;
        this._animRefFrameWidth = refFrame.width;
        this._animRefFrameHeight = refFrame.height;

        // Position at the same location as the static sprite within its reel
        anim.x = this.staticSprite.x;
        anim.y = this.staticSprite.y;

        // Keep overlay size stable even if animation frames have different source sizes
        const frame = anim.texture.frame;
        const frameAdjust = Math.min(refFrame.width / frame.width, refFrame.height / frame.height);
        anim.scale.set(this._animBaseScale * frameAdjust);
        anim.visible = false;
        anim.gotoAndStop(0);

        reelContainer.addChild(anim);

        anim.onComplete = () => {
            anim.gotoAndStop(0);
            this._animFinished = true;
        };

        this._animSprite = anim;
        this._pulsePhase = 'growing';
        this._pulseElapsed = 0;
        this._animFinished = false;
    }

    /** Spawn VFX sprite on the shared vfxLayer. */
    showVfx(vfxLayer: Container, frames: import('pixi.js').Texture[]): void {
        if (frames.length === 0) return;

        const vfx = new AnimatedSprite(frames, false);
        vfx.anchor.set(0.5);
        vfx.animationSpeed = 0.45;
        vfx.loop = false;
        vfx.x = this.reel * CELL_SIZE + this.staticSprite.x;
        vfx.y = this.staticSprite.y;
        vfx.alpha = 0;
        vfx.scale.set(CELL_SIZE / WIN_VFX_FRAME_SIZE);

        vfxLayer.addChild(vfx);
        vfx.gotoAndPlay(0);

        this._vfxSprite = vfx;
        this._vfxPhase = 'fadingIn';
        this._vfxElapsed = 0;
    }

    /** Apply dim filter to the static sprite. */
    dim(): void {
        const filter = new ColorMatrixFilter();
        filter.brightness(0.35, false);
        filter.desaturate();

        this._previousFilters = this.staticSprite.filters ? [...this.staticSprite.filters] : null;
        this._dimFilter = filter;
        this.staticSprite.filters = [...(this._previousFilters ?? []), filter];
    }

    /**
     * Advance the celebration state machine.
     * Returns true when the full cycle (vfx → pulse → done) is complete.
     */
    update(deltaMs: number): boolean {
        if (this._phase === 'vfx') {
            if (!this._vfxSprite) {
                this._phase = this._animSprite ? 'pulse' : 'done';
                return this._phase === 'done';
            }
            this._advanceVfx(deltaMs);
            return false;
        }

        if (this._phase === 'pulse') {
            this._advancePulse(deltaMs);
            return false;
        }

        return true;
    }

    /** Reset VFX + pulse back to start for looping. */
    restart(): void {
        this._phase = 'vfx';
        this._vfxPhase = 'fadingIn';
        this._vfxElapsed = 0;
        this._pulsePhase = 'growing';
        this._pulseElapsed = 0;
        this._animFinished = false;
        this.staticSprite.visible = true;
        this.staticSprite.scale.set(this._staticBaseScaleX, this._staticBaseScaleY);
        if (this._vfxSprite) {
            this._vfxSprite.gotoAndPlay(0);
            this._vfxSprite.alpha = 0;
            this._vfxSprite.visible = true;
        }
        if (this._animSprite) {
            this._animSprite.visible = false;
            this._animSprite.gotoAndStop(0);
        }
    }

    /** Whether this view has an active win animation (pulse). */
    get hasAnimation(): boolean {
        return this._animSprite !== undefined;
    }

    /** Remove all overlays, restore static sprite, remove dim filter. */
    clear(): void {
        // Clean up animated overlay
        if (this._animSprite) {
            this._animSprite.onComplete = undefined;
            this._animSprite.visible = false;
            if (this._animSprite.parent) this._animSprite.parent.removeChild(this._animSprite);
            this._animSprite.stop();
            this._animSprite.destroy();
            this._animSprite = undefined;
        }

        // Restore static sprite
        this.staticSprite.visible = true;
        this.staticSprite.scale.set(this._staticBaseScaleX, this._staticBaseScaleY);

        // Remove dim filter
        if (this._dimFilter) {
            this.staticSprite.filters = this._previousFilters;
            this._dimFilter = undefined;
            this._previousFilters = null;
        }

        // VFX sprite is destroyed by the vfxLayer nuke in SlotMachineView,
        // so we just drop the reference here
        this._vfxSprite = undefined;
    }

    // ── Private: VFX sub-phase ───────────────────────────────────

    private _advanceVfx(deltaMs: number): void {
        if (!this._vfxSprite) return;

        this._vfxElapsed += deltaMs;

        // Manually advance frames (autoUpdate is off)
        if (this._vfxSprite.playing) this._vfxSprite.update(Ticker.shared);

        // Detect animation end
        if (!this._vfxSprite.playing && this._vfxPhase === 'playing') {
            this._vfxPhase = 'fadingOut';
            this._vfxElapsed = 0;
        }

        if (this._vfxPhase === 'fadingIn') {
            const t = Math.min(this._vfxElapsed / WIN_VFX_FADE_MS, 1);
            this._vfxSprite.alpha = t;
            if (t >= 1) {
                this._vfxPhase = 'playing';
                this._vfxElapsed = 0;
            }
        } else if (this._vfxPhase === 'fadingOut') {
            const t = Math.min(this._vfxElapsed / WIN_VFX_FADE_MS, 1);
            this._vfxSprite.alpha = 1 - t;
            if (t >= 1) {
                this._vfxSprite.alpha = 0;
                this._vfxSprite.visible = false;
                if (this._animSprite) {
                    this._phase = 'pulse';
                    this._pulsePhase = 'growing';
                    this._pulseElapsed = 0;
                } else {
                    this._phase = 'done';
                }
            }
        }
    }

    // ── Private: Pulse sub-phase ─────────────────────────────────

    private _advancePulse(deltaMs: number): void {
        if (!this._animSprite) return;

        this._pulseElapsed += deltaMs;

        if (this._pulsePhase === 'growing') {
            const t = Math.min(this._pulseElapsed / WIN_PULSE_GROW_MS, 1);
            this.staticSprite.visible = true;
            this._animSprite.visible = false;
            const scaleMul = 1 + (WIN_SCALE - 1) * t;
            this.staticSprite.scale.set(
                this._staticBaseScaleX * scaleMul,
                this._staticBaseScaleY * scaleMul,
            );
            if (t >= 1) {
                this._pulsePhase = 'playing';
                this._pulseElapsed = 0;
                this._animFinished = false;
                const frame = this._animSprite.texture.frame;
                const frameAdjust = Math.min(
                    this._animRefFrameWidth / frame.width,
                    this._animRefFrameHeight / frame.height,
                );
                this._animSprite.scale.set(this._animBaseScale * frameAdjust * WIN_SCALE);
                this.staticSprite.visible = false;
                this._animSprite.visible = true;
                this._animSprite.gotoAndPlay(0);
            }
        } else if (this._pulsePhase === 'playing') {
            this.staticSprite.visible = false;
            this._animSprite.visible = true;
            const frame = this._animSprite.texture.frame;
            const frameAdjust = Math.min(
                this._animRefFrameWidth / frame.width,
                this._animRefFrameHeight / frame.height,
            );
            this._animSprite.scale.set(this._animBaseScale * frameAdjust * WIN_SCALE);
            if (this._animFinished) {
                this._pulsePhase = 'shrinking';
                this._pulseElapsed = 0;
                this._animSprite.visible = false;
                this.staticSprite.visible = true;
            }
        } else if (this._pulsePhase === 'shrinking') {
            const t = Math.min(this._pulseElapsed / WIN_PULSE_SHRINK_MS, 1);
            this.staticSprite.visible = true;
            this._animSprite.visible = false;
            const scaleMul = WIN_SCALE + (1 - WIN_SCALE) * t;
            this.staticSprite.scale.set(
                this._staticBaseScaleX * scaleMul,
                this._staticBaseScaleY * scaleMul,
            );
            if (t >= 1) {
                this._phase = 'done';
                this.staticSprite.scale.set(this._staticBaseScaleX, this._staticBaseScaleY);
            }
        }
    }
}
