import { ButtonView } from "../../Abstractions/button-view";
import { bundle } from "../../Abstractions/view";
import { Sprite, Assets, Graphics } from "pixi.js";
import { gameSignals } from "../../Signals/game-signals";

export class SpinButtonView extends ButtonView {
    private background!: Graphics;
    private iconSprite!: Sprite;
    private _isAutoMode: boolean = false;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Circular background with magical cyan accent - PLAY button is the main action
        this.background = new Graphics();
        this.background.circle(0, 0, 58);
        this.background.fill({ color: 0x00d4aa });  // Magical cyan accent
        this.background.stroke({ color: 0x00a88a, width: 4, join: 'round', cap: 'round' });  // Darker cyan border
        this.addChild(this.background);

        // Icon centered at (0,0) - dark icon on accent background
        const sheet = Assets.get('ui_icons');
        this.iconSprite = new Sprite(sheet.textures['play.png']);
        this.iconSprite.anchor.set(0.5);
        this.iconSprite.tint = 0x0a1520;  // Dark icon for contrast on cyan
        this.iconSprite.scale.set(0.58);
        this.addChild(this.iconSprite);

        this.setupInteractivity();
    }

    onMouseClick(): void {
        gameSignals.spinPressed.emit();
    }

    public setAutoMode(active: boolean): void {
        this._isAutoMode = active;
        const sheet = Assets.get('ui_icons');
        this.iconSprite.texture = sheet.textures[active ? 'autoplay.png' : 'play.png'];
    }

    public getAutoMode(): boolean {
        return this._isAutoMode;
    }
}
