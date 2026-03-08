import { View, bundle } from "../../Abstractions/view";
import { Text, TextStyle, Graphics } from "pixi.js";
import { ButtonView } from "../../Abstractions/button-view";
import { GameModel, BET_STEPS } from "../SlotMachine/game-model";
import { AudioManager } from "../../Audio/audio-manager";

/** Half-pill shaped +/- button for mobile bet control. */
class PlusMinusButton extends ButtonView {
    private _bg!: Graphics;
    private _label!: Text;
    private _isDisabled = false;
    private _onClick: () => void;
    private _symbol: string;
    private _side: 'left' | 'right';

    constructor(symbol: string, side: 'left' | 'right', onClick: () => void) {
        super();
        this._symbol = symbol;
        this._side = side;
        this._onClick = onClick;
    }

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        const w = 125;
        const h = 54;
        const r = 27;

        this._bg = new Graphics();
        if (this._side === 'left') {
            // Left half-pill: rounded left, flat right
            this._bg.moveTo(r, 0);
            this._bg.lineTo(w, 0);
            this._bg.lineTo(w, h);
            this._bg.lineTo(r, h);
            this._bg.arc(r, h - r, r, Math.PI * 0.5, Math.PI);
            this._bg.lineTo(0, r);
            this._bg.arc(r, r, r, Math.PI, Math.PI * 1.5);
            this._bg.closePath();
        } else {
            // Right half-pill: flat left, rounded right
            this._bg.moveTo(0, 0);
            this._bg.lineTo(w - r, 0);
            this._bg.arc(w - r, r, r, -Math.PI * 0.5, 0);
            this._bg.lineTo(w, h - r);
            this._bg.arc(w - r, h - r, r, 0, Math.PI * 0.5);
            this._bg.lineTo(0, h);
            this._bg.closePath();
        }
        this._bg.fill({ color: 0x252b3d });
        this._bg.stroke({ color: 0x3a4255, width: 2 });
        this.addChild(this._bg);

        const style = new TextStyle({
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: 42,
            fill: 0xc8cdd8,
            fontWeight: '500'
        });
        this._label = new Text({ text: this._symbol, style });
        this._label.anchor.set(0.5, 0.5);
        this._label.position.set(w / 2, h / 2 - 1);
        this.addChild(this._label);

        this.setupInteractivity();
    }

    protected playClickSfx(): void {
        if (!this._isDisabled) {
            AudioManager.play(this._symbol === '+' ? 'positiveClick' : 'negativeClick');
        }
    }

    onMouseClick(): void {
        if (!this._isDisabled) this._onClick();
    }

    setDisabled(disabled: boolean): void {
        this._isDisabled = disabled;
        this._label.tint = disabled ? 0x4a5568 : 0xc8cdd8;
        this._bg.tint = disabled ? 0x888888 : 0xffffff;
        this.cursor = disabled ? 'default' : 'pointer';
    }
}

/**
 * Mobile bet display — 285x125.
 * Row 1: "DEMO BET" + value on same line.
 * Row 2: half-pill − and + buttons.
 * Row 3: progress bar.
 */
export class MobileBetDisplayView extends View {
    private background!: Graphics;
    private labelText!: Text;
    private valueText!: Text;
    private progressBar!: Graphics;
    private progressFill!: Graphics;
    private plusBtn!: PlusMinusButton;
    private minusBtn!: PlusMinusButton;
    private _unsubscribeBet?: () => void;
    private _unsubscribeSpinning?: () => void;
    private _unsubscribeAutoSpin?: () => void;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Background (285x190)
        this.background = new Graphics();
        this.background.roundRect(0, 0, 285, 200, 12);
        this.background.fill({ color: 0x1a1f2e });
        this.background.stroke({ color: 0x2a3345, width: 3 });
        this.addChild(this.background);

        // Row 1: "DEMO BET" left + value right, same line
        const labelStyle = new TextStyle({
            fontFamily: 'Birch Std, Arial, sans-serif',
            fontSize: 34,
            fill: 0x8892a8,
            fontWeight: '600',
            letterSpacing: 1
        });
        this.labelText = new Text({ text: 'DEMO BET', style: labelStyle });
        this.labelText.anchor.set(0, 0.5);
        this.labelText.position.set(18, 43);
        this.addChild(this.labelText);

        const valueStyle = new TextStyle({
            fontFamily: 'Forte, Arial, sans-serif',
            fontSize: 40,
            fill: 0xe8eaf0,
            fontWeight: 'bold'
        });
        this.valueText = new Text({ text: '€2.00', style: valueStyle });
        this.valueText.anchor.set(1, 0.5);
        this.valueText.position.set(267, 43);
        this.addChild(this.valueText);

        // Row 2: half-pill buttons (minus left, plus right)
        const btnY = 85;
        const btnGap = 5;
        const btnW = 125;
        const totalW = btnW * 2 + btnGap;
        const startX = (285 - totalW) / 2;

        this.minusBtn = new PlusMinusButton('−', 'left', () => GameModel.decreaseBet());
        this.minusBtn.appear();
        this.minusBtn.position.set(startX, btnY);
        this.addChild(this.minusBtn);

        this.plusBtn = new PlusMinusButton('+', 'right', () => GameModel.increaseBet());
        this.plusBtn.appear();
        this.plusBtn.position.set(startX + btnW + btnGap, btnY);
        this.addChild(this.plusBtn);

        // Row 3: progress bar
        this.progressBar = new Graphics();
        this.progressBar.roundRect(18, 165, 249, 10, 5);
        this.progressBar.fill({ color: 0x141824 });
        this.addChild(this.progressBar);

        this.progressFill = new Graphics();
        this.addChild(this.progressFill);

        this._unsubscribeBet = GameModel.betChanged.connect(({ amount, index }) => {
            this._updateDisplay(amount, index);
        });

        this._unsubscribeSpinning = GameModel.spinningChanged.connect(() => {
            this._refreshButtons();
        });

        this._unsubscribeAutoSpin = GameModel.autoSpinRemainingChanged.connect(() => {
            this._refreshButtons();
        });

        this._updateDisplay(GameModel.betAmount, GameModel.betIndex);
    }

    protected dispose(): void {
        this._unsubscribeBet?.();
        this._unsubscribeSpinning?.();
        this._unsubscribeAutoSpin?.();
    }

    private _updateProgressBar(index: number): void {
        this.progressFill.clear();
        const progress = index / (BET_STEPS.length - 1);
        const width = Math.max(10, progress * 249);
        this.progressFill.roundRect(18, 165, width, 10, 5);
        this.progressFill.fill({ color: 0x00d4aa });
    }

    private _refreshButtons(): void {
        const isBlocked = GameModel.isSpinning || GameModel.autoSpinRemaining > 0;
        if (isBlocked) {
            this.plusBtn.setDisabled(true);
            this.minusBtn.setDisabled(true);
        } else {
            this.plusBtn.setDisabled(GameModel.betIndex >= BET_STEPS.length - 1);
            this.minusBtn.setDisabled(GameModel.betIndex <= 0);
        }
    }

    private _updateDisplay(amount: number, index: number): void {
        this.valueText.text = `€${amount.toFixed(2)}`;
        this._updateProgressBar(index);
        this._refreshButtons();
    }
}
