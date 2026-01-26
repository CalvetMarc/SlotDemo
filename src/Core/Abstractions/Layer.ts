import { Container } from "pixi.js";
import { View } from "./View";

export abstract class Layer extends Container {
    protected layerViews: Partial<Record<string, View>>;

    constructor(layerViews?: Partial<Record<string, View>>){
        super();

        this.layerViews = { ...layerViews };
    }

    abstract resize(): void;

    addView(id: string, view: View){
        this.layerViews[id] = view;
        this.addChild(view);
    }

    removeView(id: string){
        const view = this.layerViews[id];
        if (!view) return;

        view.destroy({ children: true });
        delete this.layerViews[id];
    }   
}