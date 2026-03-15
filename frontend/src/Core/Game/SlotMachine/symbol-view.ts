import { Sprite, Container, AnimatedSprite, Assets, ColorMatrixFilter, Spritesheet, Ticker } from 'pixi.js';
import type { SymbolId } from '@shared/types';
import { CELL_SIZE } from './slot-config';
import { evalKeyframes, type Keyframe } from '../../Animation/keyframe-lerp';
import { AudioManager } from '../../Audio/audio-manager';

// ── Animated symbol mapping ──────────────────────────────────────

/** Maps SymbolId → { asset: bundle asset key, anim: animation key inside the spritesheet }. */
const LOW_SYMBOLS: ReadonlySet<SymbolId> = new Set(['J.png', 'Q.png', 'K.png', 'A.png'] as SymbolId[]);

const HIGH_SYMBOL_SFX: Partial<Record<SymbolId, 'h1Sfx' | 'h2Sfx' | 'wolfSfx'>> = {
    '1.png': 'h1Sfx',
    '2.png': 'h2Sfx',
    '3.png': 'wolfSfx',
};

const ANIMATED_SYMBOL_MAP: Partial<Record<SymbolId, { asset: string; anim: string }>> = {
    '1.png':           { asset: 'king_animated',    anim: 'king' },
    '2.png':           { asset: 'queen_animated',   anim: 'queen' },
    '3.png':           { asset: 'wolf_animated',    anim: 'wolf_icon' },
    'J.png':           { asset: 'j_animated',       anim: 'J' },
    'K.png':           { asset: 'k_animated',       anim: 'K' },
    'Q.png':           { asset: 'q_animated',       anim: 'Q' },
    'A.png':           { asset: 'a_animated',       anim: 'A' },
};

// ── Celebration phase ────────────────────────────────────────────

type CelebrationPhase = 'vfx' | 'pulse' | 'done';

// ── Win pulse constants ──────────────────────────────────────────

const WIN_PULSE_GROW_MS = 280;
const WIN_PULSE_SHRINK_MS = 220;
const WIN_SCALE = 1.15;

type PulseSubPhase = 'growing' | 'playing' | 'shrinking';

// ── Heartbeat (scale-only beats for symbols without spritesheet animation) ──
// Runs during the 'playing' sub-phase. Values are scale multipliers (WIN_SCALE = baseline).
// Two lub-DUB beats that roughly match the duration of spritesheet animations.

// 30 frames @ 0.3 speed @ 60fps ≈ 1667ms — two slow lub-DUB beats to match
const HEARTBEAT_BEAT_SCALE = 1.08;
const HEARTBEAT_BEAT_SMALL = HEARTBEAT_BEAT_SCALE * 0.7;
const HEARTBEAT_KEYFRAMES: readonly Keyframe[] = [
    { time: 0,    value: WIN_SCALE },
    // Beat 1
    { time: 200,  value: WIN_SCALE * HEARTBEAT_BEAT_SCALE },
    { time: 420,  value: WIN_SCALE },
    { time: 580,  value: WIN_SCALE * HEARTBEAT_BEAT_SMALL },
    { time: 800,  value: WIN_SCALE },
    // Beat 2
    { time: 1000, value: WIN_SCALE * HEARTBEAT_BEAT_SCALE },
    { time: 1220, value: WIN_SCALE },
    { time: 1380, value: WIN_SCALE * HEARTBEAT_BEAT_SMALL },
    { time: 1560, value: WIN_SCALE },
    // Hold to match spritesheet duration
    { time: 1670, value: WIN_SCALE },
];
const HEARTBEAT_DURATION_MS = HEARTBEAT_KEYFRAMES[HEARTBEAT_KEYFRAMES.length - 1].time;

// ── Win VFX constants ────────────────────────────────────────────

const WIN_VFX_FIRST_FRAME = 2;
const WIN_VFX_LAST_FRAME = 39;
const WIN_VFX_FRAME_SIZE = 350;
const WIN_VFX_FADE_MS = 220;

// Shared gold filter — created once, reused across all gold VFX sprites
let _goldFilter: ColorMatrixFilter | null = null;
function getGoldFilter(): ColorMatrixFilter {
    if (!_goldFilter) {
        _goldFilter = new ColorMatrixFilter();
        _goldFilter.hue(110, false);
    }
    return _goldFilter;
}

type VfxSubPhase = 'fadingIn' | 'playing' | 'fadingOut';

// ── Object pools (reduce allocations per win cycle) ──────────────

const VFX_POOL: AnimatedSprite[] = [];
const VFX_POOL_MAX = 15;

function acquireVfx(frames: import('pixi.js').Texture[]): AnimatedSprite {
    const vfx = VFX_POOL.pop();
    if (vfx) {
        vfx.textures = frames;
        vfx.visible = true;
        return vfx;
    }
    return new AnimatedSprite(frames, false);
}

function releaseVfx(vfx: AnimatedSprite): void {
    vfx.stop();
    vfx.visible = false;
    vfx.alpha = 1;
    vfx.filters = [];
    if (vfx.parent) vfx.parent.removeChild(vfx);
    if (VFX_POOL.length < VFX_POOL_MAX) {
        VFX_POOL.push(vfx);
    } else {
        vfx.destroy();
    }
}

const ANIM_POOL: Map<string, AnimatedSprite[]> = new Map();
const ANIM_POOL_MAX_PER_KEY = 5;

function acquireAnimSprite(assetKey: string, frames: import('pixi.js').Texture[]): AnimatedSprite {
    const pool = ANIM_POOL.get(assetKey);
    const sprite = pool?.pop();
    if (sprite) {
        sprite.textures = frames;
        sprite.visible = true;
        return sprite;
    }
    return new AnimatedSprite(frames);
}

function releaseAnimSprite(assetKey: string, sprite: AnimatedSprite): void {
    sprite.stop();
    sprite.visible = false;
    sprite.onComplete = undefined;
    if (sprite.parent) sprite.parent.removeChild(sprite);
    let pool = ANIM_POOL.get(assetKey);
    if (!pool) {
        pool = [];
        ANIM_POOL.set(assetKey, pool);
    }
    if (pool.length < ANIM_POOL_MAX_PER_KEY) {
        pool.push(sprite);
    } else {
        sprite.destroy();
    }
}

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
    reel: number;
    row: number;
    symbolId: SymbolId;
    staticSprite: Sprite;

    // Celebration phase
    private _phase: CelebrationPhase = 'vfx';
    private _isWinning = false;

    // Win animation (pulse)
    private _animSprite?: AnimatedSprite;
    private _heartbeatElapsed = 0;
    private _pulsePhase: PulseSubPhase = 'growing';
    private _pulseElapsed = 0;
    private _animFinished = false;
    private _staticBaseScaleX: number;
    private _staticBaseScaleY: number;
    private _animBaseScale = 0;
    private _animRefFrameWidth = 0;
    private _animRefFrameHeight = 0;

    // Animated overlay asset key (for pooling)
    private _animAssetKey?: string;

    // VFX
    private _vfxSprite?: AnimatedSprite;
    private _vfxPhase: VfxSubPhase = 'fadingIn';
    private _vfxElapsed = 0;

    // Pending timeouts (for audio SFX delays)
    private _pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

    // Dim (shared celebration filter for B&W effect, not owned by this view)
    private _dimFilter?: ColorMatrixFilter;
    private _isDimmed = false;

    constructor(reel: number, row: number, symbolId: SymbolId, staticSprite: Sprite) {
        this.reel = reel;
        this.row = row;
        this.symbolId = symbolId;
        this.staticSprite = staticSprite;
        this._staticBaseScaleX = staticSprite.scale.x;
        this._staticBaseScaleY = staticSprite.scale.y;
    }

    /** Reinitialize this view for reuse from a pool. */
    reset(reel: number, row: number, symbolId: SymbolId, staticSprite: Sprite): void {
        this.clear();
        this.reel = reel;
        this.row = row;
        this.symbolId = symbolId;
        this.staticSprite = staticSprite;
        this._staticBaseScaleX = staticSprite.scale.x;
        this._staticBaseScaleY = staticSprite.scale.y;
        this._phase = 'vfx';
        this._isWinning = false;
        this._heartbeatElapsed = 0;
        this._pulsePhase = 'growing';
        this._pulseElapsed = 0;
        this._animFinished = false;
        this._animBaseScale = 0;
        this._animRefFrameWidth = 0;
        this._animRefFrameHeight = 0;
        this._vfxPhase = 'fadingIn';
        this._vfxElapsed = 0;
    }

    /** Spawn animated overlay on the reel container and start pulse cycle. */
    showWinAnimation(reelContainer: Container): void {
        this._isWinning = true;

        // Clear any leftover filters (e.g. tension dim still fading out)
        this.staticSprite.filters = [];

        const mapping = ANIMATED_SYMBOL_MAP[this.symbolId];
        if (!mapping) {
            // No spritesheet animation — heartbeat scale pulse will be used
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

        this._animAssetKey = mapping.asset;
        const anim = acquireAnimSprite(mapping.asset, sheet.animations[mapping.anim]);
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

    /** Spawn VFX sprite on the shared vfxLayer. Pass gold=true for wild celebrations. */
    showVfx(vfxLayer: Container, frames: import('pixi.js').Texture[], gold = false): void {
        if (frames.length === 0) return;

        const vfx = acquireVfx(frames);
        vfx.anchor.set(0.5);
        vfx.animationSpeed = 0.45;
        vfx.loop = false;
        vfx.x = this.reel * CELL_SIZE + this.staticSprite.x;
        vfx.y = this.staticSprite.y;
        vfx.alpha = 0;
        vfx.scale.set(CELL_SIZE / WIN_VFX_FRAME_SIZE);

        if (gold) {
            vfx.filters = [getGoldFilter()];
        }

        vfxLayer.addChild(vfx);
        vfx.gotoAndPlay(0);

        this._vfxSprite = vfx;
        this._vfxPhase = 'fadingIn';
        this._vfxElapsed = 0;
    }

    /** Dim the static sprite. Uses shared ColorMatrixFilter for B&W celebration effect. */
    dim(sharedFilter: ColorMatrixFilter): void {
        this._dimFilter = sharedFilter;
        this._isDimmed = true;
        this.staticSprite.filters = [sharedFilter];
    }

    /**
     * Advance the celebration state machine.
     * Returns true when the full cycle (vfx → pulse → done) is complete.
     */
    update(deltaMs: number): boolean {
        if (this._phase === 'vfx') {
            if (!this._vfxSprite) {
                this._phase = this._isWinning ? 'pulse' : 'done';
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
        this._heartbeatElapsed = 0;
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

    /** Whether this view has active work (win animation or VFX). */
    get hasAnimation(): boolean {
        return this._isWinning || this._vfxSprite !== undefined;
    }

    /** Remove all overlays, restore static sprite, remove dim filter. */
    clear(): void {
        this._isWinning = false;

        // Clear pending audio timeouts
        for (const t of this._pendingTimeouts) clearTimeout(t);
        this._pendingTimeouts.length = 0;

        // Return animated overlay to pool
        if (this._animSprite) {
            if (this._animAssetKey) {
                releaseAnimSprite(this._animAssetKey, this._animSprite);
            } else {
                this._animSprite.destroy();
            }
            this._animSprite = undefined;
            this._animAssetKey = undefined;
        }

        // Restore static sprite
        this.staticSprite.visible = true;
        this.staticSprite.scale.set(this._staticBaseScaleX, this._staticBaseScaleY);

        // Remove dim filter (shared, not owned — don't destroy)
        if (this._isDimmed) {
            this.staticSprite.filters = [];
            this._dimFilter = undefined;
            this._isDimmed = false;
        }

        // Return VFX sprite to pool
        if (this._vfxSprite) {
            releaseVfx(this._vfxSprite);
            this._vfxSprite = undefined;
        }
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
                if (this._isWinning) {
                    this._phase = 'pulse';
                    this._pulsePhase = 'growing';
                    this._pulseElapsed = 0;
                    this._heartbeatElapsed = 0;
                } else {
                    this._phase = 'done';
                }
            }
        }
    }

    // ── Private: Pulse sub-phase ─────────────────────────────────

    private _advancePulse(deltaMs: number): void {
        this._pulseElapsed += deltaMs;

        if (this._pulsePhase === 'growing') {
            const t = Math.min(this._pulseElapsed / WIN_PULSE_GROW_MS, 1);
            const scaleMul = 1 + (WIN_SCALE - 1) * t;
            this.staticSprite.visible = true;
            if (this._animSprite) this._animSprite.visible = false;
            this.staticSprite.scale.set(
                this._staticBaseScaleX * scaleMul,
                this._staticBaseScaleY * scaleMul,
            );
            if (t >= 1) {
                this._pulsePhase = 'playing';
                this._pulseElapsed = 0;
                this._heartbeatElapsed = 0;

                if (this._animSprite) {
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
                    if (LOW_SYMBOLS.has(this.symbolId)) {
                        this._pendingTimeouts.push(setTimeout(() => {
                            AudioManager.stop('lowWin');
                            AudioManager.play('lowWin');
                        }, 200));
                    }
                    const highSfx = HIGH_SYMBOL_SFX[this.symbolId];
                    if (highSfx) {
                        const rate = highSfx === 'h2Sfx' ? 0.9 : highSfx === 'wolfSfx' ? 1 : 1.3;
                        const delay = highSfx === 'wolfSfx' ? 100 : 200;
                        this._pendingTimeouts.push(setTimeout(() => {
                            AudioManager.stop(highSfx);
                            AudioManager.play(highSfx, undefined, rate);
                        }, delay));
                    }
                } else if (this.symbolId === 'Wild_01.png' as SymbolId) {
                    this._pendingTimeouts.push(setTimeout(() => {
                        AudioManager.stop('heartbeatSfx');
                        AudioManager.play('heartbeatSfx');
                    }, 200));
                }
            }
        } else if (this._pulsePhase === 'playing') {
            if (this._animSprite) {
                // Spritesheet animation path
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
            } else {
                // Heartbeat path: scale beats on the static sprite
                this._heartbeatElapsed += deltaMs;
                if (this._heartbeatElapsed >= HEARTBEAT_DURATION_MS) {
                    this._pulsePhase = 'shrinking';
                    this._pulseElapsed = 0;
                    this.staticSprite.scale.set(
                        this._staticBaseScaleX * WIN_SCALE,
                        this._staticBaseScaleY * WIN_SCALE,
                    );
                } else {
                    this._applyHeartbeatScale();
                }
            }
        } else if (this._pulsePhase === 'shrinking') {
            const t = Math.min(this._pulseElapsed / WIN_PULSE_SHRINK_MS, 1);
            this.staticSprite.visible = true;
            if (this._animSprite) this._animSprite.visible = false;
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

    // ── Private: Heartbeat keyframe interpolation ────────────────

    private _applyHeartbeatScale(): void {
        const scaleMul = evalKeyframes(HEARTBEAT_KEYFRAMES, this._heartbeatElapsed);
        this.staticSprite.scale.set(
            this._staticBaseScaleX * scaleMul,
            this._staticBaseScaleY * scaleMul,
        );
    }
}
