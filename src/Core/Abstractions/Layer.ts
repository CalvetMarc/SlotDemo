import { Container } from "pixi.js";
import { View, ViewConfig } from "./View";
import { DesignCanvas } from "../Layout/DesignCanvas";
import { ViewLayoutManager } from "../Managers/ViewLayoutManager";
import { CentralLayerManager } from "../Managers/CentralLayerManager";

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

    /** Returns the current canvas for this layer. */
    getCurrentCanvas(): DesignCanvas | undefined {
        return this.currentCanvas;
    }

    /** Adds a view to this layer and applies layout if canvas is available. */
    addView(id: string, view: View, config?: ViewConfig){
        this.layerViews[id] = view;
        this.addChild(view);

        // Register view for relativeTo lookups (include layerId for coordinate conversion)
        CentralLayerManager.I.registerView(id, view, this.layerId);

        if (config) {
            this.viewConfigs.set(id, config);

            if (this.currentCanvas) {
                // Pass layerId to convert relativeTo coordinates to this layer's local space
                const viewLookup = CentralLayerManager.I.createViewLookup(this.layerId);
                this.layoutManager.applyLayout(view, config, this.currentCanvas, viewLookup);
            }
        }
    }

    /** Removes a view from this layer. */
    removeView(id: string){
        const view = this.layerViews[id];
        if (!view) return;

        // Unregister from relativeTo lookups
        CentralLayerManager.I.unregisterView(id);

        view.destroy({ children: true });
        delete this.layerViews[id];
        this.viewConfigs.delete(id);
    }

    /** Updates layout for all views in this layer. Uses two-pass for relativeTo support. */
    updateViewLayouts(canvas: DesignCanvas): void {
        const viewLookup = CentralLayerManager.I.createViewLookup(this.layerId);

        // Single pass: partition into independent and relativeTo-dependent views
        const independent: { view: View; config: ViewConfig }[] = [];
        const dependent: { view: View; config: ViewConfig }[] = [];

        for (const [viewId, view] of Object.entries(this.layerViews)) {
            if (!view) continue;
            const config = this.viewConfigs.get(viewId);
            if (!config) continue;

            if (this.layoutManager.usesRelativeTo(config, canvas)) {
                dependent.push({ view, config });
            } else {
                independent.push({ view, config });
            }
        }

        // Pass 1: Layout independent views first
        for (const { view, config } of independent) {
            this.layoutManager.updateLayout(view, config, canvas, viewLookup);
        }

        // Pass 2: Layout dependent views (their targets are now positioned)
        for (const { view, config } of dependent) {
            this.layoutManager.updateLayout(view, config, canvas, viewLookup);
        }
    }

    /** @deprecated Use updateViewLayouts() instead. */
    getViews(): Partial<Record<string, View>> {
        return this.layerViews;
    }
}