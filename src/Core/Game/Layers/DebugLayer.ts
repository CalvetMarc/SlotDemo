import { Layer } from "../../Abstractions/Layer";
import { View } from "../../Abstractions/View";
import { DesignCanvas } from "../../Layout/DesignCanvas";

/** Debug layer for debug information, FPS counter, development tools. */
export class DebugLayer extends Layer {
    constructor(zIndex: number = 7, layerViews?: Partial<Record<string, View>>){
        super('debug', zIndex, layerViews);
    }

    onLayoutChanged(canvas: DesignCanvas): void {
        super.onLayoutChanged(canvas);
    }

    resize(): void{

    }
}
