import { View, bundle } from "../../Abstractions/View";
import { Text, TextStyle, Graphics } from "pixi.js";

export class BalanceDisplayView extends View {
    private background!: Graphics;
    private labelText!: Text;
    private valueText!: Text;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Glassmorphism background
        this.background = new Graphics();
        this.background.roundRect(-10, -25, 120, 50, 12);
        this.background.fill({ color: 0x000000, alpha: 0.6 });
        this.addChild(this.background);

        // Label
        const labelStyle = new TextStyle({
            fontFamily: 'Arial, sans-serif',
            fontSize: 10,
            fill: 0x888888,
            fontWeight: '600',
            letterSpacing: 1
        });
        this.labelText = new Text({ text: 'BALANCE', style: labelStyle });
        this.labelText.anchor.set(0, 0.5);
        this.labelText.position.set(0, -10);
        this.addChild(this.labelText);

        // Value
        const valueStyle = new TextStyle({
            fontFamily: 'Arial, sans-serif',
            fontSize: 18,
            fill: 0xffffff,
            fontWeight: 'bold'
        });
        this.valueText = new Text({ text: '€5,000.00', style: valueStyle });
        this.valueText.anchor.set(0, 0.5);
        this.valueText.position.set(0, 10);
        this.addChild(this.valueText);
    }

    public setValue(value: string): void {
        if (this.valueText) {
            this.valueText.text = value;
        }
    }
}
