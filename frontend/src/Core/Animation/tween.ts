import type { Container, Sprite } from 'pixi.js';
import { type EaseFn, linear } from './easing';

// ── Types ────────────────────────────────────────────────────────

enum TweenState {
    WAIT,
    ACTIVE,
    PAUSED,
    FINISHED,
}

export interface TweenConfig<TContext> {
    duration: number;
    context: TContext;
    tweenFn: (t: number, ctx: TContext) => void;
    easing?: EaseFn;
    waitTime?: number;
    onComplete?: (ctx: TContext) => void;
}

/** Non-generic handle for storing/killing tweens without caring about TContext. */
export interface TweenHandle {
    readonly isFinished: boolean;
    readonly finished: Promise<void>;
    kill(): void;
    pause(): void;
    resume(): void;
}

// ── Tween ────────────────────────────────────────────────────────

export class Tween<TContext = unknown> implements TweenHandle {
    private _state: TweenState;
    private _elapsed = 0;
    private _duration: number;
    private _waitTime: number;
    private _easing: EaseFn;
    private _tweenFn: (t: number, ctx: TContext) => void;
    private _context: TContext;
    private _onComplete?: (ctx: TContext) => void;
    private _isLoop = false;
    private _next?: Tween;

    private _resolveFinished?: () => void;
    private _finishedPromise?: Promise<void>;

    constructor(config: TweenConfig<TContext>) {
        this._duration = config.duration;
        this._context = config.context;
        this._tweenFn = config.tweenFn;
        this._easing = config.easing ?? linear;
        this._waitTime = config.waitTime ?? 0;
        this._onComplete = config.onComplete;
        this._state = this._waitTime > 0 ? TweenState.WAIT : TweenState.ACTIVE;
    }

    /** Chain another tween to start when this one finishes. */
    chain<TNext>(config: TweenConfig<TNext>): Tween<TNext> {
        const next = new Tween(config);
        next._state = TweenState.WAIT;
        this._next = next as Tween;
        return next;
    }

    /** Await completion (resolves when FINISHED or killed). */
    get finished(): Promise<void> {
        if (this._state === TweenState.FINISHED) return Promise.resolve();
        if (!this._finishedPromise) {
            this._finishedPromise = new Promise<void>((resolve) => {
                this._resolveFinished = resolve;
            });
        }
        return this._finishedPromise;
    }

    get isFinished(): boolean {
        return this._state === TweenState.FINISHED;
    }

    kill(): void {
        this._state = TweenState.FINISHED;
        this._resolve();
    }

    pause(): void {
        if (this._state === TweenState.ACTIVE) this._state = TweenState.PAUSED;
    }

    resume(): void {
        if (this._state === TweenState.PAUSED) this._state = TweenState.ACTIVE;
    }

    /** Advance by deltaMs. Returns true when finished. */
    update(deltaMs: number): boolean {
        if (this._state === TweenState.FINISHED) return true;
        if (this._state === TweenState.PAUSED) return false;

        this._elapsed += deltaMs;

        if (this._state === TweenState.WAIT) {
            if (this._elapsed < this._waitTime) return false;
            this._elapsed -= this._waitTime;
            this._state = TweenState.ACTIVE;
        }

        const t = Math.min(this._elapsed / this._duration, 1);
        this._tweenFn(this._easing(t), this._context);

        if (t >= 1) {
            if (this._isLoop) {
                this._elapsed = 0;
                return false;
            }
            this._state = TweenState.FINISHED;
            this._onComplete?.(this._context);
            this._resolve();

            if (this._next) {
                this._next._state = this._next._waitTime > 0 ? TweenState.WAIT : TweenState.ACTIVE;
                TweenManager.add(this._next as Tween<unknown>);
            }
            return true;
        }

        return false;
    }

    /** @internal */
    _setLoop(isLoop: boolean): void {
        this._isLoop = isLoop;
    }

    private _resolve(): void {
        this._resolveFinished?.();
        this._resolveFinished = undefined;
    }
}

// ── TweenManager ─────────────────────────────────────────────────

export class TweenManager {
    private static _tweens: Tween[] = [];

    static add<T>(config: TweenConfig<T>): Tween<T>;
    static add<T>(tween: Tween<T>): Tween<T>;
    static add<T>(configOrTween: TweenConfig<T> | Tween<T>): Tween<T> {
        const tween = configOrTween instanceof Tween ? configOrTween : new Tween(configOrTween);
        TweenManager._tweens.push(tween as Tween);
        return tween;
    }

    static addLoop<T>(config: TweenConfig<T>): Tween<T> {
        const tween = new Tween(config);
        tween._setLoop(true);
        TweenManager._tweens.push(tween as Tween);
        return tween;
    }

    static kill(tween: Tween): void {
        tween.kill();
    }

    static killAll(): void {
        for (const tween of TweenManager._tweens) {
            tween.kill();
        }
        TweenManager._tweens.length = 0;
    }

    static update(deltaMs: number): void {
        const tweens = TweenManager._tweens;
        for (let i = tweens.length - 1; i >= 0; i--) {
            if (tweens[i].update(deltaMs)) {
                tweens[i] = tweens[tweens.length - 1];
                tweens.pop();
            }
        }
    }

    // ── Premade helpers ──────────────────────────────────────────

    static fadeTo(target: Sprite | Container, alpha: number, duration: number, easing?: EaseFn): Tween<{ target: Sprite | Container; from: number; to: number }> {
        return TweenManager.add({
            duration,
            context: { target, from: target.alpha, to: alpha },
            tweenFn: (t, ctx) => { ctx.target.alpha = ctx.from + (ctx.to - ctx.from) * t; },
            easing,
        });
    }

    static scaleTo(target: Container, scale: number, duration: number, easing?: EaseFn): Tween<{ target: Container; fromX: number; fromY: number; to: number }> {
        return TweenManager.add({
            duration,
            context: { target, fromX: target.scale.x, fromY: target.scale.y, to: scale },
            tweenFn: (t, ctx) => {
                ctx.target.scale.set(
                    ctx.fromX + (ctx.to - ctx.fromX) * t,
                    ctx.fromY + (ctx.to - ctx.fromY) * t,
                );
            },
            easing,
        });
    }

    static moveTo(target: Container, pos: { x: number; y: number }, duration: number, easing?: EaseFn): Tween<{ target: Container; fromX: number; fromY: number; toX: number; toY: number }> {
        return TweenManager.add({
            duration,
            context: { target, fromX: target.x, fromY: target.y, toX: pos.x, toY: pos.y },
            tweenFn: (t, ctx) => {
                ctx.target.x = ctx.fromX + (ctx.toX - ctx.fromX) * t;
                ctx.target.y = ctx.fromY + (ctx.toY - ctx.fromY) * t;
            },
            easing,
        });
    }
}
