import { ButtonView } from "../../Abstractions/ButtonView";
import { bundle } from "../../Abstractions/View";
import { Sprite, Assets, Graphics } from "pixi.js";

export class MenuButtonView extends ButtonView {
    private background!: Graphics;
    private iconSprite!: Sprite;

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
    }

    onMouseClick(): void {
        // TODO: Open menu
    }
}
