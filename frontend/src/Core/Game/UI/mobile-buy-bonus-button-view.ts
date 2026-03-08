import { ButtonView } from "../../Abstractions/button-view";
import { bundle } from "../../Abstractions/view";
import { Text, TextStyle, Graphics, Ticker } from "pixi.js";
import { gameSignals } from "../../Signals/game-signals";
import { GameModel } from "../SlotMachine/game-model";
import { AudioManager } from "../../Audio/audio-manager";

/**
 * Buy bonus button for mobile 16:9 landscape (285x125).
 * "BUY BONUS" in one line with rainbow animation.
 */
export class MobileBuyBonusButtonView extends ButtonView {
    private background!: Graphics;
    private strokeGraphic!: Graphics;
    private label!: Text;
    private _hue: number = 0;
    private _isDisabled = false;
    private tickerCallback!: () => void;
    private _unsubSpinning?: () => void;
    private _unsubAutoSpin?: () => void;

    private _rainbowSpeed: number = 0.8;
    private _rainbowSaturation: number = 60;
    private _rainbowLightness: number = 60;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Background fill (285x125)
        this.background = new Graphics();
        this.background.roundRect(0, 0, 285, 125, 12);
        this.background.fill({ color: 0x000000, alpha: 0.6 });
        this.addChild(this.background);

        // Stroke (rainbow tinted)
        this.strokeGraphic = new Graphics();
        this.strokeGraphic.roundRect(0, 0, 285, 125, 12);
        this.strokeGraphic.stroke({ color: 0xffffff, width: 3 });
        this.addChild(this.strokeGraphic);

        // "BUY BONUS" single line
        const style = new TextStyle({
            fontFamily: 'Birch Std, Arial, sans-serif',
            fontSize: 54,
            fill: 0xffffff,
            fontWeight: 'bold',
            letterSpacing: 4
        });
        this.label = new Text({ text: 'BUY BONUS', style });
        this.label.anchor.set(0.5, 0.5);
        this.label.position.set(142, 62);
        this.addChild(this.label);

        this.setupInteractivity();

        this.tickerCallback = () => this.updateRainbow();
        Ticker.shared.add(this.tickerCallback);

        this._unsubSpinning = GameModel.spinningChanged.connect(() => this._refreshDisabled());
        this._unsubAutoSpin = GameModel.autoSpinRemainingChanged.connect(() => this._refreshDisabled());
    }

    protected playClickSfx(): void {
        if (!this._isDisabled) AudioManager.play('positiveClick');
    }

    onMouseClick(): void {
        if (this._isDisabled) return;
        gameSignals.buyBonusPressed.emit();
    }

    private _refreshDisabled(): void {
        this._isDisabled = GameModel.isSpinning || GameModel.autoSpinRemaining > 0;
        this.tint = this._isDisabled ? 0x8a90a0 : 0xffffff;
        this.cursor = this._isDisabled ? 'default' : 'pointer';
    }

    private updateRainbow(): void {
        this._hue = (this._hue + this._rainbowSpeed) % 360;
        const color = this.hslToHex(this._hue, this._rainbowSaturation, this._rainbowLightness);
        this.strokeGraphic.tint = color;
        this.label.tint = color;
    }

    private hslToHex(h: number, s: number, l: number): number {
        s /= 100;
        l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color);
        };
        return (f(0) << 16) + (f(8) << 8) + f(4);
    }

    protected dispose(): void {
        if (this.tickerCallback) {
            Ticker.shared.remove(this.tickerCallback);
        }
        this._unsubSpinning?.();
        this._unsubAutoSpin?.();
    }
}
