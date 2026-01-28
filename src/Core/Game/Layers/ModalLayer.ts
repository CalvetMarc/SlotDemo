import { Layer } from "../../Abstractions/Layer";
import { View } from "../../Abstractions/View";
import { DesignCanvas } from "../../Layout/DesignCanvas";

/** Modal layer for modals, popups, dialogs. */
export class ModalLayer extends Layer {
    constructor(zIndex: number = 6, layerViews?: Partial<Record<string, View>>){
        super('modal', zIndex, layerViews);
    }

    onLayoutChanged(canvas: DesignCanvas): void {
        super.onLayoutChanged(canvas);
    }

    resize(): void{

    }
}
