import { View, bundle } from "../../Abstractions/view";
import { Container, Graphics } from "pixi.js";
import { SpinButtonView } from "./spin-button-view";
import { AutoSpinButtonView } from "./auto-spin-button-view";
import { TurboButtonView } from "./turbo-button-view";
import { GameModel } from "../SlotMachine/game-model";

export class SpinControlsView extends View {
    private bar!: Graphics;
    private spinButton!: SpinButtonView;
    private autoButton!: AutoSpinButtonView;
    private turboButton!: TurboButtonView;
    private _pickerContainer!: Container;
    private _unsubSpinning?: () => void;
    private _unsubRemaining?: () => void;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Extended bar background (pill shape)
        this.bar = new Graphics();
        this.bar.roundRect(-170, -40, 340, 80, 40);
        this.bar.fill({ color: 0x1a1f2e });
        this.bar.stroke({ color: 0x2a3345, width: 3, join: 'round', cap: 'round' });
        this.addChild(this.bar);

        // Auto button (left)
        this.autoButton = new AutoSpinButtonView();
        this.autoButton.appear();
        this.autoButton.position.set(-110, 0);
        this.addChild(this.autoButton);

        // Turbo button (right)
        this.turboButton = new TurboButtonView();
        this.turboButton.appear();
        this.turboButton.position.set(110, 0);
        this.addChild(this.turboButton);

        // Spin button (center, on top)
        this.spinButton = new SpinButtonView();
        this.spinButton.appear();
        this.addChild(this.spinButton);

        // Picker on top of everything (positioned at auto button's x)
        this._pickerContainer = this.autoButton.getPickerContainer();
        this._pickerContainer.position.set(this.autoButton.x, -35);
        this.addChild(this._pickerContainer);

        // Toggle stop icon based on spinning + autoplay state
        this._unsubSpinning = GameModel.spinningChanged.connect(({ isSpinning }) => {
            if (isSpinning) {
                // First spin with autoplay selected: kick off autoplay
                const count = this.autoButton.getSelectedCount();
                if (count > 0 && GameModel.autoSpinRemaining === 0) {
                    this.autoButton.hidePicker();
                    GameModel.setAutoSpinRemaining(count);
                }
                // Show stop icon while spinning with autoplay
                if (GameModel.autoSpinRemaining > 0) {
                    this.spinButton.setAutoMode(true);
                } else {
                    // Non-autoplay: show stop icon so player can skip
                    this.spinButton.setSkipMode(true);
                }
            } else {
                this.spinButton.setSkipMode(false);
                const isBonusPause = GameModel.autoSpinRemaining > 0
                    && GameModel.lastResult?.bonusTriggered;
                if (GameModel.autoSpinRemaining <= 0 || isBonusPause) {
                    this.spinButton.setAutoMode(false);
                }
            }
        });

        // When remaining count changes: update mini pill on auto button
        this._unsubRemaining = GameModel.autoSpinRemainingChanged.connect(({ count }) => {
            if (count > 0) {
                this.autoButton.updateMiniPillCount(count);
            } else {
                this.spinButton.setAutoMode(false);
                this.autoButton.resetState();
            }
        });

    }

    protected dispose(): void {
        this._unsubSpinning?.();
        this._unsubRemaining?.();
    }

    public getSpinButton(): SpinButtonView {
        return this.spinButton;
    }

    public getAutoButton(): AutoSpinButtonView {
        return this.autoButton;
    }

    public getTurboButton(): TurboButtonView {
        return this.turboButton;
    }

    public onSpin(callback: () => void): void {
        this.spinButton.on('pointerdown', callback);
    }
}
