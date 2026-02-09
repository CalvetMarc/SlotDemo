import { ButtonView } from "../../Abstractions/button-view";
import { bundle } from "../../Abstractions/view";
import { Sprite, Assets, Rectangle } from "pixi.js";

export type ArrowDirection = 'up' | 'down';

export class ArrowButtonView extends ButtonView {
    private iconSprite!: Sprite;
    private _direction: ArrowDirection;
    private _onClick: () => void;
    private _isDisabled: boolean = false;

    // Debug mode - set to true to see hit bounds
    public static DEBUG_BOUNDS: boolean = false;

    // Fixed hit area size
    private static HIT_WIDTH: number = 40;
    private static HIT_HEIGHT: number = 45;

    // Sprite offset from center (to separate arrows visually)
    private static SPRITE_OFFSET: number = 15;

    constructor(direction: ArrowDirection, onClick: () => void) {
        super();
        this._direction = direction;
        this._onClick = onClick;
    }

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        const sheet = Assets.get('ui_icons');
        const textureName = this._direction === 'up' ? 'betUp.png' : 'betDown.png';

        this.iconSprite = new Sprite(sheet.textures[textureName]);
        this.iconSprite.anchor.set(0.5);
        this.iconSprite.tint = 0xc8cdd8;  // Soft off-white
        this.iconSprite.scale.set(0.4);

        // Offset sprite to separate arrows visually
        // UP arrow moves up (negative y), DOWN arrow moves down (positive y)
        this.iconSprite.y = this._direction === 'up'
            ? -ArrowButtonView.SPRITE_OFFSET
            : ArrowButtonView.SPRITE_OFFSET;
        this.addChild(this.iconSprite);

        // Hit area extends in ONE direction only:
        // UP arrow: hitArea extends UPWARD (negative y)
        // DOWN arrow: hitArea extends DOWNWARD (positive y)
        if (this._direction === 'up') {
            this.hitArea = new Rectangle(
                -ArrowButtonView.HIT_WIDTH / 2,
                -ArrowButtonView.HIT_HEIGHT,  // extends upward from 0
                ArrowButtonView.HIT_WIDTH,
                ArrowButtonView.HIT_HEIGHT
            );
        } else {
            this.hitArea = new Rectangle(
                -ArrowButtonView.HIT_WIDTH / 2,
                0,  // extends downward from 0
                ArrowButtonView.HIT_WIDTH,
                ArrowButtonView.HIT_HEIGHT
            );
        }

        this.showDebugBounds(ArrowButtonView.DEBUG_BOUNDS);
        this.setupInteractivity();
    }

    onMouseClick(): void {
        if (!this._isDisabled) {
            this._onClick();
        }
    }

    public setDisabled(disabled: boolean): void {
        this._isDisabled = disabled;
        if (disabled) {
            this.iconSprite.tint = 0x4a5568;
        } else {
            // Preserve hover state if currently hovered
            this.iconSprite.tint = this.isHovered ? this.hoverTint : this.normalTint;
        }
        this.cursor = disabled ? 'default' : 'pointer';
    }

    public getDisabled(): boolean {
        return this._isDisabled;
    }

    protected applyHoverTint(): void {
        if (!this._isDisabled) {
            this.iconSprite.tint = this.hoverTint;
        }
    }

    protected removeHoverTint(): void {
        this.iconSprite.tint = this._isDisabled ? 0x4a5568 : this.normalTint;
    }
}
