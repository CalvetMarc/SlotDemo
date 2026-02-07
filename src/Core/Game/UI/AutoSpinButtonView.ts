import { ButtonView } from "../../Abstractions/ButtonView";
import { bundle } from "../../Abstractions/View";
import { Sprite, Assets } from "pixi.js";

export class AutoSpinButtonView extends ButtonView {
    private iconSprite!: Sprite;
    private isActive: boolean = false;

    // Debug mode - set to true to see hit bounds
    public static DEBUG_BOUNDS: boolean = false;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Icon only (background is in SpinControlsView bar) - soft off-white
        const sheet = Assets.get('ui_icons');
        this.iconSprite = new Sprite(sheet.textures['auto.png']);
        this.iconSprite.anchor.set(0.5);
        this.iconSprite.tint = 0xc8cdd8;  // Soft off-white
        this.iconSprite.scale.set(0.3);
        this.addChild(this.iconSprite);

        this.showDebugBounds(AutoSpinButtonView.DEBUG_BOUNDS);
        this.setupInteractivity();
    }

    onMouseClick(): void {
        this.setActive(!this.isActive);
    }

    public setActive(active: boolean): void {
        this.isActive = active;
        this.iconSprite.tint = active ? 0x00d4aa : 0xc8cdd8;  // Magical cyan when active
    }

    public getActive(): boolean {
        return this.isActive;
    }
}
