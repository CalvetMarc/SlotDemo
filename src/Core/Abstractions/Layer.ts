import { Container } from "pixi.js";
import { View, ViewConfig } from "./View";
import { DesignCanvas } from "../Layout/DesignCanvas";
import { ViewLayoutManager } from "../Orchestors/ViewLayoutManager";

/** Base layer class for organizing views in a game screen. */
export class Layer extends Container {
    protected layerViews: Partial<Record<string, View>>;
    private viewConfigs: Map<string, ViewConfig> = new Map();
    private layoutManager: ViewLayoutManager = new ViewLayoutManager();
    private currentCanvas?: DesignCanvas;
    public readonly layerId: string;

    constructor(layerId: string, zIndex: number = 0, layerViews?: Partial<Record<string, View>>){
        super();

        this.layerId = layerId;
        this.zIndex = zIndex;
        this.layerViews = { ...layerViews };
    }

    /** Called when canvas changes. Stores canvas for view positioning. */
    onLayoutChanged(canvas: DesignCanvas): void {
        this.currentCanvas = canvas;
    }

    /** Adds a view to this layer and applies layout if canvas is available. */
    addView(id: string, view: View, config?: ViewConfig){
        this.layerViews[id] = view;
        this.addChild(view);

        if (config) {
            this.viewConfigs.set(id, config);

            if (this.currentCanvas) {
                this.layoutManager.applyLayout(view, config, this.currentCanvas);
            }
        }
    }

    /** Removes a view from this layer. */
    removeView(id: string){
        const view = this.layerViews[id];
        if (!view) return;

        view.destroy({ children: true });
        delete this.layerViews[id];
        this.viewConfigs.delete(id);
    }

    /** Updates layout for all views in this layer. */
    updateViewLayouts(canvas: DesignCanvas): void {
        for (const [viewId, view] of Object.entries(this.layerViews)) {
            if (!view) continue;

            const viewConfig = this.viewConfigs.get(viewId);
            if (viewConfig) {
                this.layoutManager.updateLayout(view, viewConfig, canvas);
            }
        }
    }

    /** @deprecated Use updateViewLayouts() instead. */
    getViews(): Partial<Record<string, View>> {
        return this.layerViews;
    }
}