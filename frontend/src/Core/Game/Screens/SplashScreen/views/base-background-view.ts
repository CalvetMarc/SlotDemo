import { bundle, View } from "../../../../Abstractions/view";
import { Sprite } from "pixi.js";
import { isMobileDevice } from "../../../../Utils/device";

export class BaseBackgroundView extends View{
    private sprite!: Sprite;

    bundleNeeded(): bundle {
        return "boot";
    }

    appear(): void {
        this.sprite = Sprite.from("background");
        // Don't set anchor here - let the layout system handle it
        this.addChild(this.sprite);

        // Flip horizontally on mobile landscape
        const aspect = window.innerWidth / window.innerHeight;
        if (isMobileDevice() && Math.abs(aspect - 16/9) < 0.15) {
            this.sprite.anchor.set(1, 0);
            this.sprite.scale.x = -1;
        }
    }
}