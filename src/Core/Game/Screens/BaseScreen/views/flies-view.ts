import { bundle, View } from "../../../../Abstractions/view";
import { Container } from "pixi.js";

export class FliesView extends View {
    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Particles will be added here when implemented
    }
}
