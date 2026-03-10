import { View, bundle } from "../../Abstractions/view";
import { Container, Graphics } from "pixi.js";
import { AutoSpinButtonView } from "./auto-spin-button-view";
import { TurboButtonView } from "./turbo-button-view";
import { GameModel } from "../SlotMachine/game-model";

/**
 * Auto + Turbo pill for mobile 16:9 landscape (left side).
 * Handles auto-spin count initiation and mini pill updates.
 */
export class MobileAutoTurboView extends View {
    private autoButton!: AutoSpinButtonView;
    private turboButton!: TurboButtonView;
    private _pickerContainer!: Container;
    private _unsubSpinning?: () => void;
    private _unsubRemaining?: () => void;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Pill background
        const bar = new Graphics();
        bar.roundRect(-55, -22, 110, 44, 22);
        bar.fill({ color: 0x1a1f2e });
        bar.stroke({ color: 0x2a3345, width: 2, join: 'round', cap: 'round' });
        this.addChild(bar);

        // Auto button (left)
        this.autoButton = new AutoSpinButtonView();
        this.autoButton.appear();
        this.autoButton.scale.set(0.6, 0.6);
        this.autoButton.position.set(-27, 0);
        this.addChild(this.autoButton);

        // Turbo button (right)
        this.turboButton = new TurboButtonView();
        this.turboButton.appear();
        this.turboButton.scale.set(0.6, 0.6);
        this.turboButton.position.set(27, 0);
        this.addChild(this.turboButton);

        // Picker positioned above auto button — scaled up for mobile readability
        this._pickerContainer = this.autoButton.getPickerContainer();
        this._pickerContainer.scale.set(1 / 0.6);
        this._pickerContainer.position.set(-27, -40);
        this.addChild(this._pickerContainer);

        this._unsubSpinning = GameModel.spinningChanged.connect(({ isSpinning }) => {
            if (isSpinning) {
                const count = this.autoButton.getSelectedCount();
                if (count > 0 && GameModel.autoSpinRemaining === 0) {
                    this.autoButton.hidePicker();
                    GameModel.setAutoSpinRemaining(count);
                }
            }
        });

        this._unsubRemaining = GameModel.autoSpinRemainingChanged.connect(({ count }) => {
            if (count > 0) {
                this.autoButton.updateMiniPillCount(count);
            } else {
                this.autoButton.resetState();
            }
        });
    }

    protected dispose(): void {
        this._unsubSpinning?.();
        this._unsubRemaining?.();
    }
}
