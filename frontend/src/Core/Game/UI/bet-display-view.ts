import { View, bundle } from "../../Abstractions/view";
import { Text, TextStyle, Graphics } from "pixi.js";
import { ArrowButtonView } from "./arrow-button-view";
import { GameModel, BET_STEPS } from "../SlotMachine/game-model";

export class BetDisplayView extends View {
    private background!: Graphics;
    private labelText!: Text;
    private valueText!: Text;
    private progressBar!: Graphics;
    private progressFill!: Graphics;
    private upArrow!: ArrowButtonView;
    private downArrow!: ArrowButtonView;
    private _unsubscribeBet?: () => void;
    private _unsubscribeSpinning?: () => void;

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
            fontFamily: 'Birch Std, Arial, sans-serif',
            fontSize: 22,
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
            fontFamily: 'Forte, Arial, sans-serif',
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

        // Up arrow button (hitArea extends upward, sprite at position)
        this.upArrow = new ArrowButtonView('up', () => GameModel.increaseBet());
        this.upArrow.appear();
        this.upArrow.position.set(155, 60);
        this.addChild(this.upArrow);

        // Down arrow button (hitArea extends downward, sprite at position)
        this.downArrow = new ArrowButtonView('down', () => GameModel.decreaseBet());
        this.downArrow.appear();
        this.downArrow.position.set(155, 60);
        this.addChild(this.downArrow);

        // Subscribe to model changes
        this._unsubscribeBet = GameModel.betChanged.connect(({ amount, index }) => {
            this._updateDisplay(amount, index);
        });

        // Block bet changes while spinning
        this._unsubscribeSpinning = GameModel.spinningChanged.connect(({ isSpinning }) => {
            if (isSpinning) {
                this.upArrow.setDisabled(true);
                this.downArrow.setDisabled(true);
            } else {
                this._updateDisplay(GameModel.betAmount, GameModel.betIndex);
            }
        });

        // Initial display from model
        this._updateDisplay(GameModel.betAmount, GameModel.betIndex);
    }

    protected dispose(): void {
        this._unsubscribeBet?.();
        this._unsubscribeSpinning?.();
    }

    private _updateProgressBar(index: number): void {
        this.progressFill.clear();
        const progress = index / (BET_STEPS.length - 1);
        const width = Math.max(8, progress * 120);
        this.progressFill.roundRect(15, 93, width, 8, 4);
        this.progressFill.fill({ color: 0x00d4aa });  // Magical cyan accent
    }

    private _updateDisplay(amount: number, index: number): void {
        this.valueText.text = `€${amount.toFixed(2)}`;
        this._updateProgressBar(index);

        // Update arrow states based on limits
        this.upArrow.setDisabled(index >= BET_STEPS.length - 1);
        this.downArrow.setDisabled(index <= 0);
    }
}
