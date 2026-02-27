import { View, bundle } from "../../Abstractions/view";
import { Text, TextStyle, Graphics } from "pixi.js";
import { gameSignals } from "../../Signals/game-signals";

export class BalanceDisplayView extends View {
    private background!: Graphics;
    private labelText!: Text;
    private valueText!: Text;
    private _unsubscribeBalance?: () => void;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Background rectangle (190x119 to match BetDisplayView visual bounds) - Dark magical theme
        this.background = new Graphics();
        this.background.roundRect(0, 0, 190, 119, 12);
        this.background.fill({ color: 0x1a1f2e });  // Deep blue-gray
        this.background.stroke({ color: 0x2a3345, width: 3 });  // Subtle blue border
        this.addChild(this.background);

        // Label "DEMO\nBALANCE" - muted blue-gray, two lines
        const labelStyle = new TextStyle({
            fontFamily: 'Birch Std, Arial, sans-serif',
            fontSize: 22,
            fill: 0x8892a8,  // Muted blue-gray
            fontWeight: '600',
            letterSpacing: 1,
            lineHeight: 24
        });
        this.labelText = new Text({ text: 'DEMO\nBALANCE', style: labelStyle });
        this.labelText.anchor.set(0, 0);
        this.labelText.position.set(15, 18);
        this.addChild(this.labelText);

        // Value - soft white for readability
        const valueStyle = new TextStyle({
            fontFamily: 'Forte, Arial, sans-serif',
            fontSize: 28,
            fill: 0xe8eaf0,  // Soft white
            fontWeight: 'bold'
        });
        this.valueText = new Text({ text: '€99,999.00', style: valueStyle });
        this.valueText.anchor.set(0, 0.5);
        this.valueText.position.set(15, 80);
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
