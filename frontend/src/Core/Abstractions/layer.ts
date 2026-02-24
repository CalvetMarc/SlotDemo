import { Container } from "pixi.js";
import { View, ViewConfig } from "./view";
import { DesignCanvas } from "../Layout/design-canvas";
import { LayoutResolver } from "../Layout/layout-constraints";
import { ViewLayoutManager } from "../Managers/view-layout-manager";
import { CentralLayerManager } from "../Managers/central-layer-manager";

/** Base layer class for organizing views in a game screen. */
export class Layer extends Container {
    protected layerViews: Partial<Record<string, View>>;
    private _viewConfigs: Map<string, ViewConfig> = new Map();
    private _layoutManager: ViewLayoutManager = new ViewLayoutManager();
    private currentCanvas?: DesignCanvas;
    private _viewportLocal: { width: number; height: number } = { width: 0, height: 0 };
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

    /** Store viewport dimensions in layer-local coordinates. */
    setViewportLocal(vp: { width: number; height: number }): void {
        this._viewportLocal = vp;
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
            this._viewConfigs.set(id, config);

            if (this.currentCanvas) {
                // Ensure viewport units resolve correctly for this layer
                LayoutResolver.viewportLocal = this._viewportLocal;
                const viewLookup = CentralLayerManager.I.createViewLookup(this.layerId);
                this._layoutManager.applyLayout(view, config, this.currentCanvas, viewLookup);
            }
        }
    }

    /** Removes a view from this layer and destroys it. */
    removeView(id: string){
        const view = this.layerViews[id];
        if (!view) return;

        CentralLayerManager.I.unregisterView(id);
        view.destroy({ children: true });
        delete this.layerViews[id];
        this._viewConfigs.delete(id);
    }

    /** Detaches a view from this layer WITHOUT destroying it. Returns the view for pooling. */
    detachView(id: string): View | undefined {
        const view = this.layerViews[id];
        if (!view) return undefined;

        CentralLayerManager.I.unregisterView(id);
        this.removeChild(view);
        delete this.layerViews[id];
        this._viewConfigs.delete(id);
        return view;
    }

    /** Updates layout for all views in this layer. Uses two-pass for relativeTo support. */
    updateViewLayouts(canvas: DesignCanvas): void {
        LayoutResolver.viewportLocal = this._viewportLocal;
        const viewLookup = CentralLayerManager.I.createViewLookup(this.layerId);

        // Single pass: partition into independent and relativeTo-dependent views
        const independent: { view: View; config: ViewConfig }[] = [];
        const dependent: { view: View; config: ViewConfig }[] = [];

        for (const [viewId, view] of Object.entries(this.layerViews)) {
            if (!view) continue;
            const config = this._viewConfigs.get(viewId);
            if (!config) continue;

            if (this._layoutManager.usesRelativeTo(config, canvas)) {
                dependent.push({ view, config });
            } else {
                independent.push({ view, config });
            }
        }

        // Pass 1: Layout independent views first
        for (const { view, config } of independent) {
            this._layoutManager.updateLayout(view, config, canvas, viewLookup);
        }

        // Pass 2: Layout dependent views (their targets are now positioned)
        for (const { view, config } of dependent) {
            this._layoutManager.updateLayout(view, config, canvas, viewLookup);
        }
    }

    /** @deprecated Use updateViewLayouts() instead. */
    getViews(): Partial<Record<string, View>> {
        return this.layerViews;
    }
}