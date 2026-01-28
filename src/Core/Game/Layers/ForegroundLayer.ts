import { Layer } from "../../Abstractions/Layer";
import { View } from "../../Abstractions/View";
import { DesignCanvas } from "../../Layout/DesignCanvas";

/** Foreground layer for decorative frames and foreground elements. */
export class ForegroundLayer extends Layer {
    constructor(zIndex: number = 2, layerViews?: Partial<Record<string, View>>){
        super('foreground', zIndex, layerViews);
    }

    onLayoutChanged(canvas: DesignCanvas): void {
        super.onLayoutChanged(canvas);
    }

    resize(): void{

    }
}
