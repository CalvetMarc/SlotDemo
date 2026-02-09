import { View, bundle } from "../../../../Abstractions/view";
import { Sprite } from "pixi.js";

export class FrameView extends View {
    private sprite!: Sprite;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        this.sprite = Sprite.from("frame");
        this.addChild(this.sprite);
    }
}
