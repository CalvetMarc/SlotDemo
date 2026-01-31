import { View, bundle } from "../../../../Abstractions/View";
import { Sprite } from "pixi.js";

export class SlotLogoView extends View {
    private sprite!: Sprite;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        this.sprite = Sprite.from("slot_logo");
        this.addChild(this.sprite);
    }
}
