import { View, bundle } from "../../Abstractions/view";
import { Text, TextStyle, Graphics } from "pixi.js";
import { gameSignals } from "../../Signals/game-signals";

/**
 * Wider balance display for mobile 16:9 landscape (285x125).
 */
export class MobileBalanceDisplayView extends View {
    private background!: Graphics;
    private labelText!: Text;
    private valueText!: Text;
    private _unsubscribeBalance?: () => void;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Background rectangle (285x125)
        this.background = new Graphics();
        this.background.roundRect(0, 0, 285, 125, 12);
        this.background.fill({ color: 0x1a1f2e });
        this.background.stroke({ color: 0x2a3345, width: 3 });
        this.addChild(this.background);

        // Label "DEMO BALANCE" - centered
        const labelStyle = new TextStyle({
            fontFamily: 'Birch Std, Arial, sans-serif',
            fontSize: 32,
            fill: 0x8892a8,
            fontWeight: '600',
            letterSpacing: 1
        });
        this.labelText = new Text({ text: 'DEMO BALANCE', style: labelStyle });
        this.labelText.anchor.set(0.5, 0);
        this.labelText.position.set(142, 16);
        this.addChild(this.labelText);

        // Value - centered
        const valueStyle = new TextStyle({
            fontFamily: 'Forte, Arial, sans-serif',
            fontSize: 40,
            fill: 0xe8eaf0,
            fontWeight: 'bold'
        });
        this.valueText = new Text({ text: '€99,999.00', style: valueStyle });
        this.valueText.anchor.set(0.5, 0.5);
        this.valueText.position.set(142, 78);
        this.addChild(this.valueText);

        this._unsubscribeBalance = gameSignals.balanceUpdated.connect(({ value }) => {
            this.setValue(`€${value.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        });
    }

    protected dispose(): void {
        this._unsubscribeBalance?.();
    }

    public setValue(value: string): void {
        if (this.valueText) {
            this.valueText.text = value;
        }
    }
}
