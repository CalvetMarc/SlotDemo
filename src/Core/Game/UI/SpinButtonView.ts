import { View, bundle } from "../../Abstractions/View";
import { Sprite, Assets, Graphics } from "pixi.js";

export class SpinButtonView extends View {
    private background!: Graphics;
    private iconSprite!: Sprite;
    private isAutoMode: boolean = false;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Background centered at (0,0)
        this.background = new Graphics();
        this.background.roundRect(-35, -35, 70, 70, 35);
        this.background.fill({ color: 0x000000, alpha: 0.6 });
        this.addChild(this.background);

        // Icon centered at (0,0)
        const sheet = Assets.get('ui_icons');
        this.iconSprite = new Sprite(sheet.textures['play.png']);
        this.iconSprite.anchor.set(0.5);
        this.iconSprite.tint = 0xffffff;
        this.iconSprite.scale.set(0.35);
        this.addChild(this.iconSprite);

        this.eventMode = 'static';
        this.cursor = 'pointer';
    }

    public setAutoMode(active: boolean): void {
        this.isAutoMode = active;
        const sheet = Assets.get('ui_icons');
        this.iconSprite.texture = sheet.textures[active ? 'autoplay.png' : 'play.png'];
    }

    public getAutoMode(): boolean {
        return this.isAutoMode;
    }
}
