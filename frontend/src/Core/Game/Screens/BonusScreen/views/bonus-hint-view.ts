import { Text, TextStyle, Ticker } from 'pixi.js';
import { bundle, View } from '../../../../Abstractions/view';

const PULSE_SPEED = 0.003;
const ALPHA_MIN = 0.3;
const ALPHA_MAX = 1;
const FADE_OUT_DURATION = 250;

export class BonusHintView extends View {
    private _text!: Text;
    private _elapsed = 0;
    private _isFading = false;
    private _fadeFrom = 1;
    private _fadeElapsed = 0;

    bundleNeeded(): bundle {
        return 'bonus';
    }

    appear(): void {
        const style = new TextStyle({
            fontFamily: 'Birch Std, Arial, sans-serif',
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

    hideHint(): void {
        this._isFading = true;
        this._fadeFrom = this.alpha;
        this._fadeElapsed = 0;
    }

    private _onTick(ticker: Ticker): void {
        if (this._isFading) {
            this._fadeElapsed += ticker.deltaMS;
            const t = Math.min(1, this._fadeElapsed / FADE_OUT_DURATION);
            this.alpha = this._fadeFrom * (1 - t);
            if (t >= 1) {
                this._isFading = false;
                Ticker.shared.remove(this._onTick, this);
            }
            return;
        }

        this._elapsed += ticker.deltaMS;
        const range = ALPHA_MAX - ALPHA_MIN;
        this.alpha = ALPHA_MIN + range * (0.5 + 0.5 * Math.sin(this._elapsed * PULSE_SPEED));
    }

    protected dispose(): void {
        Ticker.shared.remove(this._onTick, this);
    }
}
