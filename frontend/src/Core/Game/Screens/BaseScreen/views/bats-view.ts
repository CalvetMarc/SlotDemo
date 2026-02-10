import { View, bundle } from "../../../../Abstractions/view";
import { AnimatedSprite, Assets } from "pixi.js";

export class BatsView extends View {
    private sprite!: AnimatedSprite;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        const sheet = Assets.get("bats");
        this.sprite = new AnimatedSprite(sheet.animations["bats"]);
        this.sprite.animationSpeed = 0.2;
        this.sprite.play();
        this.addChild(this.sprite);
    }

    protected dispose(): void {
        this.sprite.stop();
    }
}
