import { Layer } from "../../Abstractions/Layer";
import { View } from "../../Abstractions/View";

export  class GameLayer extends Layer {   
    constructor(layerViews?: Partial<Record<string, View>>){
        super(layerViews);

    }

    resize(): void{

    }
}