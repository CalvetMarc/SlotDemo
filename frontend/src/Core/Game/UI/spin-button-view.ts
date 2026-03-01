import { ButtonView } from "../../Abstractions/button-view";
import { bundle } from "../../Abstractions/view";
import { Sprite, Assets, Graphics } from "pixi.js";
import { gameSignals } from "../../Signals/game-signals";
import { GameModel } from "../SlotMachine/game-model";

export class SpinButtonView extends ButtonView {
    private background!: Graphics;
    private iconSprite!: Sprite;
    private _isAutoMode: boolean = false;

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

    onMouseClick(): void {
        if (this._isAutoMode) {
            GameModel.setAutoSpinRemaining(0);
            return;
        }
        gameSignals.spinPressed.emit();
    }

    public setAutoMode(active: boolean): void {
        this._isAutoMode = active;
        const sheet = Assets.get('ui_icons');
        this.iconSprite.texture = sheet.textures[active ? 'stop.png' : 'play.png'];
    }

    public getAutoMode(): boolean {
        return this._isAutoMode;
    }
}
