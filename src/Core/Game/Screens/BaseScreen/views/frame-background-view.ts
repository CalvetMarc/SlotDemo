import { View, bundle } from "../../../../Abstractions/view";
import { Sprite } from "pixi.js";

export class FrameBackgroundView extends View {
    private sprite!: Sprite;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        this.sprite = Sprite.from("frame_background");
        this.addChild(this.sprite);
    }
}
