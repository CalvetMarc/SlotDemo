import { ButtonView } from "../../Abstractions/button-view";
import { bundle } from "../../Abstractions/view";
import { Sprite, Assets, Graphics } from "pixi.js";
import { gameSignals } from "../../Signals/game-signals";
import { GameModel } from "../SlotMachine/game-model";
import { AudioManager } from "../../Audio/audio-manager";

export class SpinButtonView extends ButtonView {
    private background!: Graphics;
    private iconSprite!: Sprite;
    private _isAutoMode: boolean = false;
    private _isSkipMode: boolean = false;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        this.background = new Graphics();
        this.background.circle(0, 0, 58);
        this.background.fill({ color: 0x00d4aa });
        this.background.stroke({ color: 0x00a88a, width: 4, join: 'round', cap: 'round' });
        this.addChild(this.background);

        const sheet = Assets.get('ui_icons');
        this.iconSprite = new Sprite(sheet.textures['play.png']);
        this.iconSprite.anchor.set(0.5);
        this.iconSprite.tint = 0x0a1520;
        this.iconSprite.scale.set(0.58);
        this.addChild(this.iconSprite);

        this.setupInteractivity();
    }

    protected playClickSfx(): void {
        if (this._isAutoMode) {
            AudioManager.play('negativeClick');
        } else if (this._isSkipMode) {
            // Land SFX handled by global pointerdown in slot-machine-view
        } else {
            AudioManager.play('spinMagic');
        }
    }

    onMouseClick(): void {
        if (this._isAutoMode) {
            GameModel.setAutoSpinRemaining(0);
            return;
        }
        if (this._isSkipMode) {
            gameSignals.skipRequested.emit();
            return;
        }
        gameSignals.spinPressed.emit();
    }

    public setAutoMode(active: boolean): void {
        this._isAutoMode = active;
        this._updateIcon();
    }

    public setSkipMode(active: boolean): void {
        this._isSkipMode = active;
        this._updateIcon();
    }

    public getAutoMode(): boolean {
        return this._isAutoMode;
    }

    private _updateIcon(): void {
        const sheet = Assets.get('ui_icons');
        const isStop = this._isAutoMode || this._isSkipMode;
        this.iconSprite.texture = sheet.textures[isStop ? 'stop.png' : 'play.png'];
    }
}
