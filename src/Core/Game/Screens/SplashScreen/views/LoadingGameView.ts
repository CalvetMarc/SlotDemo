import { View } from "../../../../Abstractions/View";
import { bundle } from "../../../../Abstractions/View";
import { AnimatedSprite } from "pixi.js";
import { Assets } from "pixi.js";

export class LoadingGameView extends View{
    private animSprite!: AnimatedSprite;

    bundleNeeded(): bundle {
        return "boot";
    }

    appear(): void {
        const sheet = Assets.get('loading');
        this.animSprite = new AnimatedSprite(sheet.animations.loading);
        this.animSprite.anchor.set(0.5);
        this.animSprite.animationSpeed = -0.05;
        this.animSprite.play();

        this.addChild(this.animSprite);
    }
}