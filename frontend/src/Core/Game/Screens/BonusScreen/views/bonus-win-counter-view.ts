import { Text, TextStyle } from 'pixi.js';
import { bundle, View } from '../../../../Abstractions/view';

export class BonusWinCounterView extends View {
    private _label!: Text;
    private _valueText!: Text;

    bundleNeeded(): bundle {
        return 'bonus';
    }

    appear(): void {
        const labelStyle = new TextStyle({
            fontFamily: 'Birch Std, Arial, sans-serif',
            fontSize: 32,
            fontWeight: 'bold',
            fill: 0xcccccc,
        });

        this._label = new Text({ text: 'BONUS WIN', style: labelStyle });
        this._label.anchor.set(0.5);
        this._label.y = -30;
        this.addChild(this._label);

        const valueStyle = new TextStyle({
            fontFamily: 'Forte, Arial, sans-serif',
            fontSize: 56,
            fontWeight: 'bold',
            fill: 0xffd700,
            stroke: { color: 0x000000, width: 4 },
        });

        this._valueText = new Text({ text: '0.00', style: valueStyle });
        this._valueText.anchor.set(0.5);
        this._valueText.y = 30;
        this.addChild(this._valueText);
    }

    updateWin(amount: number): void {
        this._valueText.text = amount.toFixed(2);
    }

    showGameOver(totalWin: number): void {
        this._label.text = 'BONUS COMPLETE!';
        this._valueText.text = totalWin.toFixed(2);
    }
}
