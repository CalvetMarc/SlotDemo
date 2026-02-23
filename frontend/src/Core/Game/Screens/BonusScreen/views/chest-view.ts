import { AnimatedSprite, Assets, ColorMatrixFilter, Rectangle, Sprite, Texture, Ticker } from 'pixi.js';
import { bundle, View } from '../../../../Abstractions/view';

const SHIMMER_INTERVAL_MIN = 2000;
const SHIMMER_INTERVAL_MAX = 5000;
const SHIMMER_DURATION = 600;
const HOVER_SCALE = 1.08;
const HOVER_TWEEN_SPEED = 0.25;

// Prize reveal
const PRIZE_START_Y = 50;
const PRIZE_END_Y = -280;
const PRIZE_RISE_DURATION = 600;
const PRIZE_START_SCALE = 0.6;
const PRIZE_END_SCALE = 1.3;

export class ChestView extends View {
    private _closedSprite!: Sprite;
    private _openAnim!: AnimatedSprite;
    private _isOpened = false;
    get isOpened(): boolean { return this._isOpened; }
    private _chestIndex = -1;
    private _onPick?: (index: number) => void;

    // Hover scale — stored as multiplier over the layout-assigned base scale
    private _isHovered = false;
    private _currentHoverMul = 1;
    private _baseScaleX = 1;
    private _baseScaleY = 1;

    // Glow / shimmer
    private _glowFilter!: ColorMatrixFilter;
    private _shimmerTimer = 0;
    private _shimmerNextInterval = 0;
    private _shimmerActive = false;
    private _shimmerElapsed = 0;
    private _isDisabled = false;

    // Prize reveal
    private _prizeSprite!: Sprite;
    private _prizeAnimating = false;
    private _prizeProgress = 0;
    private _prizeResolve?: () => void;

    bundleNeeded(): bundle {
        return 'bonus';
    }

    appear(): void {
        const sheet0 = Assets.get('chest_animated_0');
        const sheet1 = Assets.get('chest_animated_1');
        const getTexture = (name: string): Texture =>
            sheet0.textures[name] ?? sheet1.textures[name];

        // Closed state: first frame of the animation
        this._closedSprite = new Sprite(getTexture('chest_01.png'));
        this._closedSprite.anchor.set(0.5);
        this.addChild(this._closedSprite);

        // Open animation: build frames from both spritesheets
        const frames: Texture[] = [];
        for (let i = 1; i <= 23; i++) {
            const name = `chest_${i.toString().padStart(2, '0')}.png`;
            const tex = getTexture(name);
            if (tex) frames.push(tex);
        }

        this._openAnim = new AnimatedSprite(frames);
        this._openAnim.anchor.set(0.5);
        this._openAnim.animationSpeed = 0.4;
        this._openAnim.loop = false;
        this._openAnim.visible = false;
        this.addChild(this._openAnim);

        // Prize sprite (no mask for now — debugging)
        this._prizeSprite = new Sprite();
        this._prizeSprite.anchor.set(0.5);
        this._prizeSprite.visible = false;
        this.addChild(this._prizeSprite);

        // Glow filter for hover/shimmer
        this._glowFilter = new ColorMatrixFilter();
        this._glowFilter.enabled = false;
        this.filters = [this._glowFilter];

        // Hit area: shrink from full texture bounds by 138px sides, 155px top, 50px bottom
        const tw = this._closedSprite.texture.width;
        const th = this._closedSprite.texture.height;
        const insetX = 138;
        const insetTop = 155;
        const insetBottom = 50;
        this.hitArea = new Rectangle(
            -tw / 2 + insetX,
            -th / 2 + insetTop,
            tw - insetX * 2,
            th - insetTop - insetBottom,
        );

        // Interactive
        this.eventMode = 'static';
        this.cursor = 'pointer';
        this.on('pointertap', this._handleTap, this);
        this.on('pointerover', this._onPointerOver, this);
        this.on('pointerout', this._onPointerOut, this);

        // Stagger shimmer timer so they don't all flash at once
        this._shimmerNextInterval = this._randomShimmerInterval();
        this._shimmerTimer = Math.random() * this._shimmerNextInterval;

        Ticker.shared.add(this._onTick, this);
    }

    setup(chestIndex: number, onPick: (index: number) => void): void {
        this._chestIndex = chestIndex;
        this._onPick = onPick;
        this._isOpened = false;
        this._closedSprite.visible = true;
        this._openAnim.visible = false;
        this._openAnim.gotoAndStop(0);
        this.eventMode = 'static';
        this.cursor = 'pointer';
        this.alpha = 1;

        this._baseScaleX = this.scale.x;
        this._baseScaleY = this.scale.y;
        this._currentHoverMul = 1;
        this._isHovered = false;
        this._isDisabled = false;
        this._glowFilter.enabled = false;
        this._glowFilter.reset();

        // Reset prize
        this._prizeSprite.visible = false;
        this._prizeAnimating = false;
        this._prizeProgress = 0;
        this._prizeResolve = undefined;
    }

    playOpen(): Promise<void> {
        this._stopIdleEffects();

        return new Promise((resolve) => {
            this._isOpened = true;
            this.eventMode = 'none';
            this.cursor = 'default';
            this._closedSprite.visible = false;
            this._openAnim.visible = true;
            this._openAnim.gotoAndPlay(0);
            this._openAnim.onComplete = () => resolve();
        });
    }

    showPrize(multiplier: number): Promise<void> {
        const sheet = Assets.get('prizes_static');
        if (!sheet) return Promise.resolve();

        const textureName = `x${multiplier}.png`;
        const texture = sheet.textures?.[textureName];
        if (!texture) return Promise.resolve();

        return this._animatePrizeSprite(texture);
    }

    showSkull(): Promise<void> {
        const sheet = Assets.get('prizes_static');
        if (!sheet) return Promise.resolve();

        const texture = sheet.textures?.['skull.png'];
        if (!texture) return Promise.resolve();

        return this._animatePrizeSprite(texture);
    }

    private _animatePrizeSprite(texture: Texture): Promise<void> {
        this._prizeSprite.texture = texture;
        this._prizeSprite.y = PRIZE_START_Y;
        this._prizeSprite.scale.set(PRIZE_START_SCALE);
        this._prizeSprite.visible = true;
        this._prizeAnimating = true;
        this._prizeProgress = 0;

        return new Promise<void>((resolve) => {
            this._prizeResolve = resolve;
        });
    }

    disable(): void {
        this._isDisabled = true;
        this._stopIdleEffects();
        this.eventMode = 'none';
        this.cursor = 'default';
        if (!this._isOpened) {
            this._glowFilter.enabled = true;
            this._glowFilter.reset();
            this._glowFilter.brightness(0.4, false);
        }
    }

    private _stopIdleEffects(): void {
        this.scale.set(this._baseScaleX, this._baseScaleY);
        this._currentHoverMul = 1;
        this._glowFilter.enabled = false;
        this._glowFilter.reset();
        this._shimmerActive = false;
    }

    private _onTick(ticker: Ticker): void {
        const dt = ticker.deltaMS;

        // Prize rise animation (runs after chest is opened)
        if (this._prizeAnimating) {
            this._prizeProgress = Math.min(1, this._prizeProgress + dt / PRIZE_RISE_DURATION);
            const eased = 1 - Math.pow(1 - this._prizeProgress, 3); // ease-out cubic

            this._prizeSprite.y = PRIZE_START_Y + (PRIZE_END_Y - PRIZE_START_Y) * eased;
            const s = PRIZE_START_SCALE + (PRIZE_END_SCALE - PRIZE_START_SCALE) * eased;
            this._prizeSprite.scale.set(s);

            if (this._prizeProgress >= 1) {
                this._prizeAnimating = false;
                this._prizeResolve?.();
                this._prizeResolve = undefined;
            }
        }

        if (this._isOpened || this._isDisabled) return;

        // Hover scale — lerp towards target multiplier
        const targetMul = this._isHovered ? HOVER_SCALE : 1;
        this._currentHoverMul += (targetMul - this._currentHoverMul) * HOVER_TWEEN_SPEED;
        this.scale.set(
            this._baseScaleX * this._currentHoverMul,
            this._baseScaleY * this._currentHoverMul,
        );

        // Shimmer pulse (periodic brightness flash)
        this._shimmerTimer += dt;
        if (!this._shimmerActive && this._shimmerTimer >= this._shimmerNextInterval) {
            this._shimmerActive = true;
            this._shimmerElapsed = 0;
            this._shimmerTimer = 0;
            this._shimmerNextInterval = this._randomShimmerInterval();
        }

        if (this._shimmerActive) {
            this._shimmerElapsed += dt;
            const progress = this._shimmerElapsed / SHIMMER_DURATION;
            if (progress >= 1) {
                this._shimmerActive = false;
                this._glowFilter.enabled = false;
                this._glowFilter.reset();
            } else {
                const brightness = 1 + 0.25 * Math.sin(progress * Math.PI);
                this._glowFilter.enabled = true;
                this._glowFilter.reset();
                this._glowFilter.brightness(brightness, false);
            }
        }
    }

    private _randomShimmerInterval(): number {
        return SHIMMER_INTERVAL_MIN + Math.random() * (SHIMMER_INTERVAL_MAX - SHIMMER_INTERVAL_MIN);
    }

    private _onPointerOver(): void {
        if (this._isOpened) return;
        this._isHovered = true;
    }

    private _onPointerOut(): void {
        this._isHovered = false;
    }

    private _handleTap(): void {
        if (this._isOpened) return;
        this._onPick?.(this._chestIndex);
    }

    protected dispose(): void {
        Ticker.shared.remove(this._onTick, this);
        this.off('pointertap', this._handleTap, this);
        this.off('pointerover', this._onPointerOver, this);
        this.off('pointerout', this._onPointerOut, this);
    }
}
