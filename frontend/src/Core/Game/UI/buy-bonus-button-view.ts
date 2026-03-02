import { ButtonView } from "../../Abstractions/button-view";
import { bundle } from "../../Abstractions/view";
import { Text, TextStyle, Graphics, Ticker } from "pixi.js";
import { gameSignals } from "../../Signals/game-signals";
import { GameModel } from "../SlotMachine/game-model";

export class BuyBonusButtonView extends ButtonView {
    private background!: Graphics;
    private strokeGraphic!: Graphics;
    private buyText!: Text;
    private bonusText!: Text;
    private _hue: number = 0;
    private _isDisabled = false;
    private tickerCallback!: () => void;
    private _unsubSpinning?: () => void;
    private _unsubAutoSpin?: () => void;

    // Rainbow animation settings
    private _rainbowSpeed: number = 0.8;      // Degrees per frame (0.5 = ~12s full cycle)
    private _rainbowSaturation: number = 60;  // 0-100 (higher = more vibrant)
    private _rainbowLightness: number = 60;   // 0-100 (50 = pure, higher = lighter)

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Background fill (static, never changes)
        this.background = new Graphics();
        this.background.roundRect(-120, -80, 240, 160, 6);
        this.background.fill({ color: 0x000000, alpha: 0.6 });
        this.addChild(this.background);

        // Stroke (drawn once with white, tinted for rainbow)
        this.strokeGraphic = new Graphics();
        this.strokeGraphic.roundRect(-120, -80, 240, 160, 6);
        this.strokeGraphic.stroke({ color: 0xffffff, width: 3 });
        this.addChild(this.strokeGraphic);

        // "BUY" text on top (white, tinted for rainbow)
        const buyStyle = new TextStyle({
            fontFamily: 'Birch Std, Arial, sans-serif',
            fontSize: 46,
            fill: 0xffffff,
            fontWeight: 'bold',
            letterSpacing: 4
        });
        this.buyText = new Text({ text: 'BUY', style: buyStyle });
        this.buyText.anchor.set(0.5, 0.5);
        this.buyText.position.set(0, -32);
        this.addChild(this.buyText);

        // "BONUS" text on bottom (white, tinted for rainbow)
        const bonusStyle = new TextStyle({
            fontFamily: 'Birch Std, Arial, sans-serif',
            fontSize: 52,
            fill: 0xffffff,
            fontWeight: 'bold',
            letterSpacing: 5
        });
        this.bonusText = new Text({ text: 'BONUS', style: bonusStyle });
        this.bonusText.anchor.set(0.5, 0.5);
        this.bonusText.position.set(0, 32);
        this.addChild(this.bonusText);

        this.setupInteractivity();

        // Start rainbow animation
        this.tickerCallback = () => this.updateRainbow();
        Ticker.shared.add(this.tickerCallback);

        this._unsubSpinning = GameModel.spinningChanged.connect(() => this._refreshDisabled());
        this._unsubAutoSpin = GameModel.autoSpinRemainingChanged.connect(() => this._refreshDisabled());
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
        // Use tint instead of geometry rebuild / text re-render
        this.strokeGraphic.tint = color;
        this.buyText.tint = color;
        this.bonusText.tint = color;
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
