import { View, bundle } from "../../Abstractions/View";
import { Sprite, Assets, Graphics } from "pixi.js";

export class MenuButtonView extends View {
    private background!: Graphics;
    private iconSprite!: Sprite;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Glassmorphism background
        this.background = new Graphics();
        this.background.roundRect(-22, -22, 44, 44, 10);
        this.background.fill({ color: 0x000000, alpha: 0.6 });
        this.addChild(this.background);

        const sheet = Assets.get('ui_icons');
        this.iconSprite = new Sprite(sheet.textures['menu.png']);
        this.iconSprite.anchor.set(0.5);
        this.iconSprite.tint = 0xffffff;
        this.iconSprite.scale.set(0.18);
        this.addChild(this.iconSprite);

        this.eventMode = 'static';
        this.cursor = 'pointer';
    }
}
