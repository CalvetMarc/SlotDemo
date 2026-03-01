import { View, bundle } from '../../Abstractions/view';
import { Text, TextStyle } from 'pixi.js';
import { gameSignals } from '../../Signals/game-signals';

export class LineWinDisplayView extends View {
    private _text!: Text;
    private _unsubPresented?: () => void;
    private _unsubCleared?: () => void;
    private _unsubSpinning?: () => void;

    bundleNeeded(): bundle {
        return 'base';
    }

    appear(): void {
        this._text = new Text({
            text: 'Line 00 pays 0000.00€',
            style: new TextStyle({
                fontFamily: 'Birch Std, Arial, sans-serif',
                fontSize: 25,
                fill: 0xd4a574,
                fontWeight: '600',
                letterSpacing: 1,
                stroke: { color: 0x000000, width: 2 },
            }),
        });
        this._text.anchor.set(0.5, 0.5);
        this.addChild(this._text);
        this._text.alpha = 0;

        this._unsubPresented = gameSignals.lineWinPresented.connect((info) => {
            this._text.text = info.isWildBonus
                ? `Wilds pay ${info.payout.toFixed(2)}€`
                : `Line ${info.lineIndex + 1} pays ${info.payout.toFixed(2)}€`;
            this._text.alpha = 1;
        });

        this._unsubCleared = gameSignals.winPresentationCleared.connect(() => {
            this._text.alpha = 0;
        });

        this._unsubSpinning = gameSignals.spinPressed.connect(() => {
            this._text.alpha = 0;
        });
    }

    protected dispose(): void {
        this._unsubPresented?.();
        this._unsubCleared?.();
        this._unsubSpinning?.();
    }
}
