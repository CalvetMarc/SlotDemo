import { Container } from "pixi.js";
import { View } from "./View";

export abstract class Layer extends Container {
    protected layerViews: Partial<Record<string, View>>;

    constructor(layerViews?: Partial<Record<string, View>>){
        super();

        this.layerViews = { ...layerViews };
    }

    abstract resize(): void;
}