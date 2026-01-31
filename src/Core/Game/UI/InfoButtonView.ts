import { View, bundle } from "../../Abstractions/View";
import { Text, TextStyle, Graphics } from "pixi.js";

export class InfoButtonView extends View {
    private background!: Graphics;
    private iconText!: Text;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Glassmorphism background
        this.background = new Graphics();
        this.background.roundRect(-22, -22, 44, 44, 10);
        this.background.fill({ color: 0x000000, alpha: 0.6 });
        this.addChild(this.background);

        const style = new TextStyle({
            fontFamily: 'Georgia, Times, serif',
            fontSize: 26,
            fill: 0xffffff,
            fontWeight: 'normal',
            fontStyle: 'italic'
        });
        this.iconText = new Text({ text: 'i', style });
        this.iconText.anchor.set(0.5, 0.5);
        this.addChild(this.iconText);

        this.eventMode = 'static';
        this.cursor = 'pointer';
    }
}
