import { View, ViewConfig } from "./view";
import { ViewRegistry } from "../Managers/view-factory";
import { ViewFactory } from "../Managers/view-factory";
import { DesignCanvas } from "../Layout/design-canvas";
import { AssetLoader } from "../Managers/asset-loader";
import { ViewInitializer } from "../Managers/view-initializer";
import { CentralLayerManager } from "../Managers/central-layer-manager";

export interface IGameScreen {
    load(): Promise<void>;
    onEnter(): Promise<void>;
    onUpdate(deltaMS: number): void;
    onExit(): Promise<void>;
    unload(): void;
}

export interface ScreenConfig {
    scene: string;
    views: ViewConfig[];
}

/** Base class for all game screens using centralized layer system. */
export abstract class GameScreen implements IGameScreen {
    private _loaded: boolean;
    private _viewLayerMap: Map<string, string> = new Map();
    private _preparedViews: { view: View; config: ViewConfig }[] = [];
    public viewPool: Map<string, View> = new Map();

    private readonly assetLoader: AssetLoader;
    private readonly viewInitializer: ViewInitializer;
    protected readonly layerManager = CentralLayerManager.I;

    abstract load(): Promise<void>;
    abstract onEnter(): Promise<void>;
    abstract onUpdate(deltaMS: number): void;
    abstract onExit(): Promise<void>;

    constructor(){
        this.assetLoader = new AssetLoader();
        this.viewInitializer = new ViewInitializer();
        this._loaded = false;
    }

    public get loaded(): boolean { return this._loaded; }

    /** Removes all views added by this screen from centralized layers. */
    public unload(){
        for (const [viewId, layerId] of this._viewLayerMap) {
            this.layerManager.getLayer(layerId).removeView(viewId);
        }
        this._viewLayerMap.clear();
        this._preparedViews = [];
    }

    /** Detaches all views from layers WITHOUT destroying them. Returns pool for reuse. */
    public releaseViews(): Map<string, View> {
        const pool = new Map<string, View>();
        for (const [viewId, layerId] of this._viewLayerMap) {
            const view = this.layerManager.getLayer(layerId).detachView(viewId);
            if (view) pool.set(viewId, view);
        }
        this._viewLayerMap.clear();
        this._preparedViews = [];
        return pool;
    }

    /** Called when canvas changes. Centralized layers handle their own layout updates. */
    public onLayoutChanged(_canvas: DesignCanvas) {
        // Layers are managed centrally, they handle their own layout updates
        // Screen-specific layout logic can be added here if needed
    }

    /**
     * Loads assets for views. Does NOT add anything to screen.
     * Call addViewsToLayers() in onEnter() to actually show the views.
     */
    protected async loadConfig(config: ScreenConfig, registry: ViewRegistry){
        const views = config.views.map(viewCfg =>
            ViewFactory.create(viewCfg.type, registry)
        );

        await this.assetLoader.loadForViews(views);

        // Store views for later - don't initialize or add to layers yet
        this._preparedViews = views.map((view, index) => ({
            view,
            config: config.views[index]
        }));

        this._loaded = true;
    }

    /**
     * Initializes prepared views and adds them to layers.
     * Reuses pooled views when available (same id + same class).
     * Call this from onEnter() after load() has completed.
     */
    protected addViewsToLayers(): void {
        for (const { view, config } of this._preparedViews) {
            const pooledView = this.viewPool.get(config.id);
            const isPooled = pooledView && pooledView.constructor === view.constructor;

            const targetView = isPooled ? pooledView! : view;

            if (isPooled) {
                this.viewPool.delete(config.id);
                targetView.id = config.id;
                targetView.resetLayoutCache();
            } else {
                this.viewInitializer.initialize(targetView, config);
            }

            const targetLayer = this.layerManager.getLayer(config.layer);
            targetLayer.addView(targetView.id, targetView, config);
            this._viewLayerMap.set(targetView.id, config.layer);
        }

        // Destroy unclaimed pooled views
        for (const view of this.viewPool.values()) {
            view.destroy({ children: true });
        }
        this.viewPool.clear();
    }

}
