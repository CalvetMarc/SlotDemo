import { Container, Text, TextStyle } from 'pixi.js';
import { TweenManager, type TweenHandle } from '../../Animation/tween';
import { easeOutCubic, easeOutElastic } from '../../Animation/easing';
import { GRID_WIDTH, GRID_HEIGHT } from './slot-config';

// ── Thresholds (multiples of total bet) ─────────────────────────

const BIG_WIN_MULTIPLIER = 10;
const SUPER_WIN_MULTIPLIER = 30;
const MEGA_WIN_MULTIPLIER = 100;

const TIER_LABELS = ['BIG WIN', 'SUPER WIN', 'MEGA WIN'] as const;

const FONT_TITLE = 'Birch Std, Arial, sans-serif';
const FONT_VALUE = 'Forte, Arial, sans-serif';

const BASE_LABEL_SIZE = 60;
const MAX_LABEL_SIZE = 100;
const BASE_VALUE_SIZE = 90;
const MAX_VALUE_SIZE = 170;
const STROKE_WIDTH = 5;

const ENTRANCE_MS = 400;
const MIN_COUNT_MS = 2000;
const MAX_COUNT_MS = 6000;
const HOLD_NORMAL_MS = 1500;
const HOLD_SKIP_MS = 500;
const EXIT_MS = 300;

// ── Helper ──────────────────────────────────────────────────────

export function isBigWin(winAmount: number, betAmount: number): boolean {
    return betAmount > 0 && (winAmount / betAmount) >= BIG_WIN_MULTIPLIER;
}

// ── BigWinView ──────────────────────────────────────────────────

export class BigWinView extends Container {
    private _tierLabel: Text;
    private _amountText: Text;

    private _countUpTween: TweenHandle | null = null;
    private _entranceTween: TweenHandle | null = null;
    private _exitTween: TweenHandle | null = null;
    private _holdTimeout: ReturnType<typeof setTimeout> | undefined;

    private _isActive = false;
    private _targetAmount = 0;
    private _betAmount = 0;

    public onComplete?: () => void;

    get isActive(): boolean {
        return this._isActive;
    }

    constructor() {
        super();

        this._tierLabel = new Text({
            text: '',
            style: new TextStyle({
                fontFamily: FONT_TITLE,
                fontSize: BASE_LABEL_SIZE,
                fill: 0x00ff00,
                fontWeight: 'bold',
                stroke: { color: 0x000000, width: STROKE_WIDTH },
                letterSpacing: 3,
            }),
        });
        this._tierLabel.anchor.set(0.5);
        this._tierLabel.y = -60;
        this.addChild(this._tierLabel);

        this._amountText = new Text({
            text: '',
            style: new TextStyle({
                fontFamily: FONT_VALUE,
                fontSize: BASE_VALUE_SIZE,
                fill: 0x00ff00,
                fontWeight: 'bold',
                stroke: { color: 0x000000, width: STROKE_WIDTH + 1 },
            }),
        });
        this._amountText.anchor.set(0.5);
        this._amountText.y = 50;
        this.addChild(this._amountText);

        this.visible = false;
    }

    show(winAmount: number, betAmount: number, isAutoplay: boolean): void {
        this._targetAmount = winAmount;
        this._betAmount = betAmount;
        this._isActive = true;
        this.visible = true;
        this.alpha = 0;
        this.scale.set(0.5);

        // Initial state
        this._tierLabel.text = this._getTierLabel(BIG_WIN_MULTIPLIER);
        this._updateColors(BIG_WIN_MULTIPLIER);
        this._updateSizes(BIG_WIN_MULTIPLIER);
        this._amountText.text = '0.00\u20AC';
        this._redrawBackdrop();

        // Entrance: fade + scale bounce
        this._entranceTween = TweenManager.fadeTo(this, 1, ENTRANCE_MS);
        TweenManager.scaleTo(this, 1, ENTRANCE_MS + 100, easeOutElastic);

        // Count-up
        const multiplier = winAmount / betAmount;
        const countDuration = Math.min(Math.max(MIN_COUNT_MS + multiplier * 20, MIN_COUNT_MS), MAX_COUNT_MS);
        const holdMs = isAutoplay ? HOLD_SKIP_MS : HOLD_NORMAL_MS;

        this._countUpTween = TweenManager.add({
            duration: countDuration,
            waitTime: ENTRANCE_MS,
            context: { view: this, target: winAmount, bet: betAmount },
            tweenFn: (t, ctx) => {
                const currentValue = t * ctx.target;
                const currentMult = currentValue / ctx.bet;
                ctx.view._updateDisplay(currentValue, currentMult);
            },
            easing: easeOutCubic,
            onComplete: (ctx) => {
                ctx.view._updateDisplay(ctx.target, ctx.target / ctx.bet);
                ctx.view._countUpTween = null;
                ctx.view._holdTimeout = setTimeout(() => {
                    ctx.view._holdTimeout = undefined;
                    ctx.view._startExit();
                }, holdMs);
            },
        });
    }

    skip(): void {
        if (!this._isActive) return;

        this._killAnimations();

        // Jump to final state
        this.alpha = 1;
        this.scale.set(1);
        const finalMult = this._targetAmount / this._betAmount;
        this._updateDisplay(this._targetAmount, finalMult);

        // Short hold then exit
        this._holdTimeout = setTimeout(() => {
            this._holdTimeout = undefined;
            this._startExit();
        }, HOLD_SKIP_MS);
    }

    hide(): void {
        this._killAnimations();
        this._isActive = false;
        this.visible = false;
        this.alpha = 0;
    }

    private _startExit(): void {
        this._exitTween = TweenManager.fadeTo(this, 0, EXIT_MS);
        this._exitTween.finished.then(() => {
            this._exitTween = null;
            this._isActive = false;
            this.visible = false;
            this.onComplete?.();
        });
    }

    private _killAnimations(): void {
        this._countUpTween?.kill();
        this._countUpTween = null;
        this._entranceTween?.kill();
        this._entranceTween = null;
        this._exitTween?.kill();
        this._exitTween = null;
        if (this._holdTimeout) {
            clearTimeout(this._holdTimeout);
            this._holdTimeout = undefined;
        }
    }

    private _updateDisplay(currentValue: number, currentMultiplier: number): void {
        this._amountText.text = `${currentValue.toFixed(2)}\u20AC`;

        // Upgrade tier label if threshold crossed
        const newLabel = this._getTierLabel(currentMultiplier);
        if (this._tierLabel.text !== newLabel) {
            this._tierLabel.text = newLabel;
            this._tierLabel.scale.set(1);
            TweenManager.scaleTo(this._tierLabel, 1.2, 120).chain({
                duration: 120,
                context: this._tierLabel,
                tweenFn: (t, lbl) => { lbl.scale.set(1.2 - 0.2 * t); },
            });
        }

        this._updateColors(currentMultiplier);
        this._updateSizes(currentMultiplier);
        this._redrawBackdrop();
    }

    private _redrawBackdrop(): void {
        // No backdrop — text renders with stroke only
    }

    private _updateColors(multiplier: number): void {
        const color = this._interpolateColor(multiplier);
        this._tierLabel.style.fill = color;
        this._amountText.style.fill = color;
    }

    private _updateSizes(multiplier: number): void {
        const t = this._normalizeMultiplier(multiplier);
        this._tierLabel.style.fontSize = Math.round(BASE_LABEL_SIZE + t * (MAX_LABEL_SIZE - BASE_LABEL_SIZE));
        this._amountText.style.fontSize = Math.round(BASE_VALUE_SIZE + t * (MAX_VALUE_SIZE - BASE_VALUE_SIZE));
    }

    private _interpolateColor(multiplier: number): number {
        // Green at BIG (15x) → yellow at SUPER (50x) → red at MEGA (150x)
        let r: number, g: number;
        if (multiplier <= SUPER_WIN_MULTIPLIER) {
            const t = Math.min(Math.max(
                (multiplier - BIG_WIN_MULTIPLIER) / (SUPER_WIN_MULTIPLIER - BIG_WIN_MULTIPLIER),
                0,
            ), 1);
            r = Math.round(t * 255);
            g = 255;
        } else {
            const t = Math.min(Math.max(
                (multiplier - SUPER_WIN_MULTIPLIER) / (MEGA_WIN_MULTIPLIER - SUPER_WIN_MULTIPLIER),
                0,
            ), 1);
            r = 255;
            g = Math.round(255 * (1 - t));
        }

        return (r << 16) | (g << 8);
    }

    private _normalizeMultiplier(multiplier: number): number {
        return Math.min(Math.max(
            (multiplier - BIG_WIN_MULTIPLIER) / (MEGA_WIN_MULTIPLIER - BIG_WIN_MULTIPLIER),
            0,
        ), 1);
    }

    private _getTierLabel(multiplier: number): string {
        if (multiplier >= MEGA_WIN_MULTIPLIER) return TIER_LABELS[2];
        if (multiplier >= SUPER_WIN_MULTIPLIER) return TIER_LABELS[1];
        return TIER_LABELS[0];
    }
}
