import { View, bundle } from "../../Abstractions/View";
import { Sprite, Assets, Graphics } from "pixi.js";

export class TurboButtonView extends View {
    private background!: Graphics;
    private iconSprite!: Sprite;
    private isActive: boolean = false;

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
        this.iconSprite = new Sprite(sheet.textures['turboOff.png']);
        this.iconSprite.anchor.set(0.5);
        this.iconSprite.tint = 0xffffff;
        this.iconSprite.scale.set(0.18);
        this.addChild(this.iconSprite);

        this.eventMode = 'static';
        this.cursor = 'pointer';

        this.on('pointerdown', () => this.toggle());
    }

    private toggle(): void {
        this.setActive(!this.isActive);
    }

    public setActive(active: boolean): void {
        this.isActive = active;
        const sheet = Assets.get('ui_icons');
        this.iconSprite.texture = sheet.textures[active ? 'turboOn.png' : 'turboOff.png'];
        this.iconSprite.tint = active ? 0xff4500 : 0xffffff;
    }

    public getActive(): boolean {
        return this.isActive;
    }
}
