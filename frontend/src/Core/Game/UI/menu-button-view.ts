import { ButtonView } from "../../Abstractions/button-view";
import { bundle } from "../../Abstractions/view";
import { Sprite, Assets, Graphics } from "pixi.js";
import { gameSignals } from "../../Signals/game-signals";
import { GameModel } from "../SlotMachine/game-model";

export class MenuButtonView extends ButtonView {
    private background!: Graphics;
    private iconSprite!: Sprite;
    private _isDisabled = false;
    private _unsubSpinning?: () => void;
    private _unsubAutoSpin?: () => void;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        const sheet = Assets.get('ui_icons');

        // Background circle (diameter 80 = pill height) - Dark magical theme
        this.background = new Graphics();
        this.background.circle(0, 0, 40);
        this.background.fill({ color: 0x1a1f2e });  // Deep blue-gray
        this.background.stroke({ color: 0x2a3345, width: 3 });  // Subtle blue border
        this.addChild(this.background);

        // Icon - soft off-white
        this.iconSprite = new Sprite(sheet.textures['menu.png']);
        this.iconSprite.anchor.set(0.5);
        this.iconSprite.tint = 0xc8cdd8;  // Soft off-white
        this.iconSprite.scale.set(0.3);
        this.addChild(this.iconSprite);

        this.setupInteractivity();

        this._unsubSpinning = GameModel.spinningChanged.connect(() => this._refreshDisabled());
        this._unsubAutoSpin = GameModel.autoSpinRemainingChanged.connect(() => this._refreshDisabled());
    }

    onMouseClick(): void {
        if (this._isDisabled) return;
        gameSignals.infoPressed.emit();
    }

    private _refreshDisabled(): void {
        this._isDisabled = GameModel.isSpinning || GameModel.autoSpinRemaining > 0;
        this.tint = this._isDisabled ? 0x8a90a0 : 0xffffff;
        this.cursor = this._isDisabled ? 'default' : 'pointer';
    }

    protected dispose(): void {
        this._unsubSpinning?.();
        this._unsubAutoSpin?.();
    }
}
