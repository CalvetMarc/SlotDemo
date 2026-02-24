import { Text, TextStyle, Ticker } from 'pixi.js';
import { bundle, View } from '../../../../Abstractions/view';

const PULSE_SPEED = 0.003;
const ALPHA_MIN = 0.3;
const ALPHA_MAX = 1;

export class BonusHintView extends View {
    private _text!: Text;
    private _elapsed = 0;

    bundleNeeded(): bundle {
        return 'bonus';
    }

    appear(): void {
        const style = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 52,
            fontWeight: 'bold',
            fill: 0xc9a84c,
            dropShadow: {
                color: 0x000000,
                blur: 4,
                distance: 2,
                angle: Math.PI / 4,
            },
        });

        this._text = new Text({ text: 'Pick a chest to reveal your prize!', style });
        this._text.anchor.set(0.5);
        this.addChild(this._text);

        Ticker.shared.add(this._onTick, this);
    }

    private _onTick(ticker: Ticker): void {
        this._elapsed += ticker.deltaMS;
        const range = ALPHA_MAX - ALPHA_MIN;
        this.alpha = ALPHA_MIN + range * (0.5 + 0.5 * Math.sin(this._elapsed * PULSE_SPEED));
    }

    protected dispose(): void {
        Ticker.shared.remove(this._onTick, this);
    }
}
