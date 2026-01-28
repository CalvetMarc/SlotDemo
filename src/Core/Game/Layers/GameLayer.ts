import { Layer } from "../../Abstractions/Layer";
import { View } from "../../Abstractions/View";
import { DesignCanvas } from "../../Layout/DesignCanvas";

/** Game layer for reels, symbols, and game elements. */
export  class GameLayer extends Layer {
    constructor(zIndex: number = 1, layerViews?: Partial<Record<string, View>>){
        super('game', zIndex, layerViews);
    }

    onLayoutChanged(canvas: DesignCanvas): void {
        super.onLayoutChanged(canvas);
    }

    resize(): void{

    }
}