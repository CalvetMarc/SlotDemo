import { bundle, View } from "../../../../Abstractions/View";
import { Sprite } from "pixi.js";

export class BaseBackgroundView extends View{      
    private sprite!: Sprite;   

    bundleNeeded(): bundle {
        return "boot";
    }

    appear(): void {
        this.sprite = Sprite.from("background");
        // Don't set anchor here - let the layout system handle it
        this.addChild(this.sprite);
    }  
}