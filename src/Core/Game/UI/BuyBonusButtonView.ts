import { ButtonView } from "../../Abstractions/ButtonView";
import { bundle } from "../../Abstractions/View";
import { Text, TextStyle, Graphics, Ticker } from "pixi.js";

export class BuyBonusButtonView extends ButtonView {
    private background!: Graphics;
    private buyText!: Text;
    private bonusText!: Text;
    private hue: number = 0;
    private tickerCallback!: () => void;

    // Rainbow animation settings
    private rainbowSpeed: number = 0.8;      // Degrees per frame (0.5 = ~12s full cycle)
    private rainbowSaturation: number = 60;  // 0-100 (higher = more vibrant)
    private rainbowLightness: number = 60;   // 0-100 (50 = pure, higher = lighter)

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Background
        this.background = new Graphics();
        this.addChild(this.background);
        this.drawBackground(0xffffff);

        // "BUY" text on top
        const buyStyle = new TextStyle({
            fontFamily: 'Arial, sans-serif',
            fontSize: 38,
            fill: 0xffffff,
            fontWeight: 'bold',
            letterSpacing: 4
        });
        this.buyText = new Text({ text: 'BUY', style: buyStyle });
        this.buyText.anchor.set(0.5, 0.5);
        this.buyText.position.set(0, -28);
        this.addChild(this.buyText);

        // "BONUS" text on bottom
        const bonusStyle = new TextStyle({
            fontFamily: 'Arial, sans-serif',
            fontSize: 44,
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
    }

    onMouseClick(): void {
        // TODO: Open buy bonus modal
    }

    private drawBackground(strokeColor: number): void {
        this.background.clear();
        this.background.roundRect(-120, -80, 240, 160, 6);
        this.background.fill({ color: 0x000000, alpha: 0.6 });
        this.background.stroke({ color: strokeColor, width: 3 });
    }

    private updateRainbow(): void {
        this.hue = (this.hue + this.rainbowSpeed) % 360;
        const color = this.hslToHex(this.hue, this.rainbowSaturation, this.rainbowLightness);
        this.buyText.style.fill = color;
        this.bonusText.style.fill = color;
        this.drawBackground(color);
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

    destroy(): void {
        if (this.tickerCallback) {
            Ticker.shared.remove(this.tickerCallback);
        }
        super.destroy();
    }
}
