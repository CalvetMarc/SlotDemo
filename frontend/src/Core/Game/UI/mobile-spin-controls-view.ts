import { View, bundle } from "../../Abstractions/view";
import { MobileSpinButtonView } from "./mobile-spin-button-view";
import { GameModel } from "../SlotMachine/game-model";

/**
 * Mobile spin controls — rectangular spin button.
 */
export class MobileSpinControlsView extends View {
    private spinButton!: MobileSpinButtonView;
    private _unsubSpinning?: () => void;
    private _unsubRemaining?: () => void;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        this.spinButton = new MobileSpinButtonView();
        this.spinButton.appear();
        this.addChild(this.spinButton);

        this._unsubSpinning = GameModel.spinningChanged.connect(({ isSpinning }) => {
            if (isSpinning) {
                if (GameModel.autoSpinRemaining > 0) {
                    this.spinButton.setAutoMode(true);
                } else {
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

        this._unsubRemaining = GameModel.autoSpinRemainingChanged.connect(({ count }) => {
            if (count > 0) {
            } else {
                this.spinButton.setAutoMode(false);
            }
        });
    }

    protected dispose(): void {
        this._unsubSpinning?.();
        this._unsubRemaining?.();
    }

    public getSpinButton(): MobileSpinButtonView {
        return this.spinButton;
    }

    public onSpin(callback: () => void): void {
        this.spinButton.on('pointerdown', callback);
    }
}
