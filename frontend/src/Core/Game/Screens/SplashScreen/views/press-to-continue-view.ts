import { Text } from 'pixi.js';
import { View, bundle } from '../../../../Abstractions/view';

const PULSE_SPEED = 0.002;
const MIN_ALPHA = 0.3;

export class PressToContinueView extends View {
    private _text!: Text;
    private _elapsed = 0;

    bundleNeeded(): bundle {
        return 'boot';
    }

    appear(): void {
        this.alpha = 0;
    }

    show(): void {
        this._text = new Text({
            text: 'Press anywhere to continue',
            style: {
                fontFamily: 'Forte',
                fontSize: 56,
                fill: 0xffffff,
                align: 'center',
            },
        });
        this._text.anchor.set(0.5);
        this.addChild(this._text);
        this.alpha = 1;
    }

    update(deltaMS: number): void {
        if (this.alpha === 0) return;
        this._elapsed += deltaMS;
        const t = (Math.sin(this._elapsed * PULSE_SPEED) + 1) / 2;
        this._text.alpha = MIN_ALPHA + t * (1 - MIN_ALPHA);
    }
}
