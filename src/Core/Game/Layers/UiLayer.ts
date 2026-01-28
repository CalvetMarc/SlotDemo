import { Layer } from "../../Abstractions/Layer";
import { View } from "../../Abstractions/View";
import { DesignCanvas } from "../../Layout/DesignCanvas";

/** UI layer for buttons, balance, win display. */
export  class UiLayer extends Layer {
    constructor(zIndex: number = 5, layerViews?: Partial<Record<string, View>>){
        super('ui', zIndex, layerViews);
    }

    onLayoutChanged(canvas: DesignCanvas): void {
        super.onLayoutChanged(canvas);
    }

    resize(): void{

    }
}