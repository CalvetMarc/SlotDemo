import { Layer } from "../../Abstractions/Layer";
import { View } from "../../Abstractions/View";
import { DesignCanvas } from "../../Layout/DesignCanvas";

/** Particle layer for effects, animations, explosions. */
export class ParticleLayer extends Layer {
    constructor(zIndex: number = 4, layerViews?: Partial<Record<string, View>>){
        super('particles', zIndex, layerViews);
    }

    onLayoutChanged(canvas: DesignCanvas): void {
        super.onLayoutChanged(canvas);
    }

    resize(): void{

    }
}
