import { View, bundle } from "../../Abstractions/View";
import { Graphics } from "pixi.js";
import { SpinButtonView } from "./SpinButtonView";
import { AutoSpinButtonView } from "./AutoSpinButtonView";
import { TurboButtonView } from "./TurboButtonView";

export class SpinControlsView extends View {
    private bar!: Graphics;
    private spinButton!: SpinButtonView;
    private autoButton!: AutoSpinButtonView;
    private turboButton!: TurboButtonView;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Extended bar background (pill shape) - Dark magical theme
        this.bar = new Graphics();
        this.bar.roundRect(-170, -40, 340, 80, 40);
        this.bar.fill({ color: 0x1a1f2e });  // Deep blue-gray
        this.bar.stroke({ color: 0x2a3345, width: 3, join: 'round', cap: 'round' });  // Subtle blue border
        this.addChild(this.bar);

        // Auto button (left) - position at 2x
        this.autoButton = new AutoSpinButtonView();
        this.autoButton.appear();
        this.autoButton.position.set(-110, 0);
        this.addChild(this.autoButton);

        // Turbo button (right) - position at 2x
        this.turboButton = new TurboButtonView();
        this.turboButton.appear();
        this.turboButton.position.set(110, 0);
        this.addChild(this.turboButton);

        // Spin button (center, on top)
        this.spinButton = new SpinButtonView();
        this.spinButton.appear();
        this.addChild(this.spinButton);
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
