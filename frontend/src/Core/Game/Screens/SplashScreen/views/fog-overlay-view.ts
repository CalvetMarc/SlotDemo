import { View } from "../../../../Abstractions/view";
import { bundle } from "../../../../Abstractions/view";
import { Sprite } from "pixi.js";

export class FogOverlayView extends View{   
    private sprite!: Sprite;   

    bundleNeeded(): bundle {
        return "boot";
    }

    appear(): void {
        this.sprite = Sprite.from("fog");
        this.sprite.anchor.set(0, 0);
        this.addChild(this.sprite);
    }
}