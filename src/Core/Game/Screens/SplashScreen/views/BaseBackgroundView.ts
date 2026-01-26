import { bundle, View } from "../../../../Abstractions/View";
import { Assets, Sprite } from "pixi.js";

export class BaseBackgroundView extends View{      
    private sprite!: Sprite;   

    bundleNeeded(): bundle {
        return "boot";
    }

    appear(): void {
        this.sprite = Sprite.from("background");
        this.sprite.anchor.set(0, 0);
        this.addChild(this.sprite);
    }  
}