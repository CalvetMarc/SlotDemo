import { View, bundle } from "../../Abstractions/view";
import { Text, TextStyle, Graphics } from "pixi.js";
import { ArrowButtonView } from "./arrow-button-view";

export class BetDisplayView extends View {
    private background!: Graphics;
    private labelText!: Text;
    private valueText!: Text;
    private progressBar!: Graphics;
    private progressFill!: Graphics;
    private upArrow!: ArrowButtonView;
    private downArrow!: ArrowButtonView;

    // Bet steps: 0.1, 0.2, then every 0.2 until 2, then every 1 until 10, then every 5 until 50, then every 25 until 100
    private _betSteps: number[] = [
        0.1, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0,
        3, 4, 5, 6, 7, 8, 9, 10,
        15, 20, 25, 30, 35, 40, 45, 50,
        75, 100
    ];
    private _currentBetIndex: number = 10; // Default to 2€ (index 10)

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Background rectangle (190x119 to match BalanceDisplayView) - Dark magical theme
        this.background = new Graphics();
        this.background.roundRect(0, 0, 190, 119, 12);
        this.background.fill({ color: 0x1a1f2e });  // Deep blue-gray
        this.background.stroke({ color: 0x2a3345, width: 3 });  // Subtle blue border
        this.addChild(this.background);

        // Label "DEMO BET" - muted blue-gray (positioned to match BalanceDisplayView)
        const labelStyle = new TextStyle({
            fontFamily: 'Arial, sans-serif',
            fontSize: 14,
            fill: 0x8892a8,  // Muted blue-gray
            fontWeight: '600',
            letterSpacing: 1
        });
        this.labelText = new Text({ text: 'DEMO BET', style: labelStyle });
        this.labelText.anchor.set(0, 0);
        this.labelText.position.set(15, 18);
        this.addChild(this.labelText);

        // Value text - soft white for readability (positioned to match BalanceDisplayView)
        const valueStyle = new TextStyle({
            fontFamily: 'Arial, sans-serif',
            fontSize: 28,
            fill: 0xe8eaf0,  // Soft white
            fontWeight: 'bold'
        });
        this.valueText = new Text({ text: '€2.00', style: valueStyle });
        this.valueText.anchor.set(0, 0.5);
        this.valueText.position.set(15, 62);
        this.addChild(this.valueText);

        // Progress bar background - darker magical
        this.progressBar = new Graphics();
        this.progressBar.roundRect(15, 93, 120, 8, 4);
        this.progressBar.fill({ color: 0x141824 });  // Deep dark blue
        this.addChild(this.progressBar);

        // Progress bar fill
        this.progressFill = new Graphics();
        this.addChild(this.progressFill);
        this.updateProgressBar();

        // Up arrow button (hitArea extends upward, sprite at position)
        this.upArrow = new ArrowButtonView('up', () => this.increaseBet());
        this.upArrow.appear();
        this.upArrow.position.set(155, 60);
        this.addChild(this.upArrow);

        // Down arrow button (hitArea extends downward, sprite at position)
        this.downArrow = new ArrowButtonView('down', () => this.decreaseBet());
        this.downArrow.appear();
        this.downArrow.position.set(155, 60);
        this.addChild(this.downArrow);

        // Update display
        this.updateDisplay();
    }

    private updateProgressBar(): void {
        this.progressFill.clear();
        const progress = this._currentBetIndex / (this._betSteps.length - 1);
        const width = Math.max(8, progress * 120);
        this.progressFill.roundRect(15, 93, width, 8, 4);
        this.progressFill.fill({ color: 0x00d4aa });  // Magical cyan accent
    }

    private updateDisplay(): void {
        const bet = this._betSteps[this._currentBetIndex];
        this.valueText.text = `€${bet.toFixed(2)}`;
        this.updateProgressBar();

        // Update arrow states based on limits
        this.upArrow.setDisabled(this._currentBetIndex >= this._betSteps.length - 1);
        this.downArrow.setDisabled(this._currentBetIndex <= 0);
    }

    private increaseBet(): void {
        if (this._currentBetIndex < this._betSteps.length - 1) {
            this._currentBetIndex++;
            this.updateDisplay();
        }
    }

    private decreaseBet(): void {
        if (this._currentBetIndex > 0) {
            this._currentBetIndex--;
            this.updateDisplay();
        }
    }

    public getBet(): number {
        return this._betSteps[this._currentBetIndex];
    }

    public setBetIndex(index: number): void {
        if (index >= 0 && index < this._betSteps.length) {
            this._currentBetIndex = index;
            this.updateDisplay();
        }
    }
}
