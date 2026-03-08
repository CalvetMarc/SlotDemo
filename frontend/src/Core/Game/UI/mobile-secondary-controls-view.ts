import { View, bundle } from "../../Abstractions/view";
import { Graphics } from "pixi.js";
import { MenuButtonView } from "./menu-button-view";
import { AudioButtonView } from "./audio-button-view";

/**
 * Grouped menu + audio controls for mobile 16:9 landscape.
 * Mirrors the auto+turbo pill from MobileSpinControlsView.
 */
export class MobileSecondaryControlsView extends View {
    private menuButton!: MenuButtonView;
    private audioButton!: AudioButtonView;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Pill background (same style as auto+turbo pill)
        const bar = new Graphics();
        bar.roundRect(-55, -22, 110, 44, 22);
        bar.fill({ color: 0x1a1f2e });
        bar.stroke({ color: 0x2a3345, width: 2, join: 'round', cap: 'round' });
        this.addChild(bar);

        // Menu button (left, same size as turbo/auto)
        this.menuButton = new MenuButtonView();
        this.menuButton.appear();
        this.menuButton.scale.set(0.6, 0.6);
        this.menuButton.position.set(-27, 0);
        // Remove individual background (pill provides it)
        const menuBg = this.menuButton.getChildAt(0);
        if (menuBg) menuBg.visible = false;
        this.addChild(this.menuButton);

        // Audio button (right, same size as turbo/auto)
        this.audioButton = new AudioButtonView();
        this.audioButton.appear();
        this.audioButton.scale.set(0.6, 0.6);
        this.audioButton.position.set(27, 0);
        // Remove individual background (pill provides it)
        const audioBg = this.audioButton.getChildAt(0);
        if (audioBg) audioBg.visible = false;
        this.addChild(this.audioButton);
    }
}
