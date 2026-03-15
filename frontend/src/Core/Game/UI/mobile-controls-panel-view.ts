import { View, bundle } from "../../Abstractions/view";
import { Container, Graphics } from "pixi.js";
import { AutoSpinButtonView } from "./auto-spin-button-view";
import { TurboButtonView } from "./turbo-button-view";
import { MenuButtonView } from "./menu-button-view";
import { AudioButtonView } from "./audio-button-view";
import { GameModel } from "../SlotMachine/game-model";

/**
 * Combined controls panel for mobile 16:9 landscape (285x125).
 * Top row: Auto + Turbo. Separator line. Bottom row: Menu + Audio.
 */
export class MobileControlsPanelView extends View {
    private autoButton!: AutoSpinButtonView;
    private turboButton!: TurboButtonView;
    private menuButton!: MenuButtonView;
    private audioButton!: AudioButtonView;
    private _pickerContainer!: Container;
    private _turboPickerContainer!: Container;
    private _unsubSpinning?: () => void;
    private _unsubRemaining?: () => void;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        const W = 285;
        const H = 188;

        // Background rect (same style as balance/bonus)
        const bg = new Graphics();
        bg.roundRect(0, 0, W, H, 12);
        bg.fill({ color: 0x1a1f2e });
        bg.stroke({ color: 0x2a3345, width: 3 });
        this.addChild(bg);

        const cx = W / 2;
        const topY = 48;
        const botY = 140;
        const spacing = 55;

        // Top row: Auto (left) + Turbo (right)
        this.autoButton = new AutoSpinButtonView();
        this.autoButton.appear();
        this.autoButton.scale.set(1.5, 1.5);
        this.autoButton.position.set(cx - spacing, topY);
        this.addChild(this.autoButton);

        this.turboButton = new TurboButtonView();
        this.turboButton.appear();
        this.turboButton.scale.set(1.5, 1.5);
        this.turboButton.position.set(cx + spacing, topY);
        this.addChild(this.turboButton);

        // Picker positioned above auto button — scaled up for mobile readability
        this._pickerContainer = this.autoButton.getPickerContainer();
        this._pickerContainer.scale.set(1.7);
        this._pickerContainer.position.set(cx - spacing, topY - 40);
        this.addChild(this._pickerContainer);

        // Turbo picker positioned above turbo button
        this._turboPickerContainer = this.turboButton.getPickerContainer();
        this._turboPickerContainer.scale.set(1.7);
        this._turboPickerContainer.position.set(cx + spacing, topY - 40);
        this.addChild(this._turboPickerContainer);

        // Separator line
        const separator = new Graphics();
        separator.moveTo(18, H / 2);
        separator.lineTo(W - 18, H / 2);
        separator.stroke({ color: 0x2a3345, width: 4 });
        this.addChild(separator);

        // Bottom row: Menu (left) + Audio (right)
        this.menuButton = new MenuButtonView();
        this.menuButton.appear();
        this.menuButton.scale.set(1.5, 1.5);
        this.menuButton.position.set(cx - spacing, botY);
        const menuBg = this.menuButton.getChildAt(0);
        if (menuBg) menuBg.visible = false;
        this.addChild(this.menuButton);

        this.audioButton = new AudioButtonView();
        this.audioButton.appear();
        this.audioButton.scale.set(1.5, 1.5);
        this.audioButton.position.set(cx + spacing, botY);
        const audioBg = this.audioButton.getChildAt(0);
        if (audioBg) audioBg.visible = false;
        this.addChild(this.audioButton);

        // Auto-spin logic
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
