import { View, bundle } from "../../Abstractions/View";
import { Text, TextStyle, Graphics } from "pixi.js";

export class BuyBonusButtonView extends View {
    private background!: Graphics;
    private labelText!: Text;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        const goldColor = 0xffc107;

        // Glassmorphism background with gold border
        this.background = new Graphics();
        this.background.roundRect(-35, -18, 70, 36, 10);
        this.background.fill({ color: 0x000000, alpha: 0.6 });
        this.addChild(this.background);

        const style = new TextStyle({
            fontFamily: 'Arial, sans-serif',
            fontSize: 14,
            fill: goldColor,
            fontWeight: 'bold',
            letterSpacing: 1
        });
        this.labelText = new Text({ text: 'BONUS', style });
        this.labelText.anchor.set(0.5, 0.5);
        this.addChild(this.labelText);

        this.eventMode = 'static';
        this.cursor = 'pointer';
    }
}
