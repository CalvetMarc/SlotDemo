import { ButtonView } from "../../Abstractions/ButtonView";
import { bundle } from "../../Abstractions/View";
import { Sprite, Assets, Graphics } from "pixi.js";

export class AudioButtonView extends ButtonView {
    private background!: Graphics;
    private iconSprite!: Sprite;
    private isOn: boolean = true;

    // Debug mode - set to true to see hit bounds
    public static DEBUG_BOUNDS: boolean = false;

    // Button size (radius)
    private static RADIUS: number = 40;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        const sheet = Assets.get('ui_icons');

        // Background circle - Dark magical theme
        this.background = new Graphics();
        this.background.circle(0, 0, AudioButtonView.RADIUS);
        this.background.fill({ color: 0x1a1f2e });  // Deep blue-gray
        this.background.stroke({ color: 0x2a3345, width: 3 });  // Subtle blue border
        this.addChild(this.background);

        // Icon - soft off-white
        this.iconSprite = new Sprite(sheet.textures['volumeOn.png']);
        this.iconSprite.anchor.set(0.5);
        this.iconSprite.tint = 0xc8cdd8;  // Soft off-white
        this.iconSprite.scale.set(0.3);
        this.addChild(this.iconSprite);

        this.showDebugBounds(AudioButtonView.DEBUG_BOUNDS);
        this.setupInteractivity();
    }

    onMouseClick(): void {
        this.setOn(!this.isOn);
    }

    public setOn(on: boolean): void {
        this.isOn = on;
        const sheet = Assets.get('ui_icons');
        this.iconSprite.texture = sheet.textures[on ? 'volumeOn.png' : 'volumeOff.png'];
    }

    public getIsOn(): boolean {
        return this.isOn;
    }
}
