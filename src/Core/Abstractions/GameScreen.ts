import { Container } from "pixi.js";
import { ViewRegistry } from "../Orchestors/ViewFactory";
import { ViewFactory } from "../Orchestors/ViewFactory";
import { ViewConfig } from "./View";
import { DesignCanvas } from "../Layout/DesignCanvas";
import { AssetLoader } from "../Orchestors/AssetLoader";
import { ViewInitializer } from "../Orchestors/ViewInitializer";
import { CentralLayerManager } from "../Orchestors/CentralLayerManager";

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
export abstract class GameScreen extends Container implements IGameScreen {
    private _loaded: boolean;
    private viewIds: string[] = [];

    private readonly assetLoader: AssetLoader;
    private readonly viewInitializer: ViewInitializer;
    protected readonly layerManager = CentralLayerManager.I;

    abstract load(): Promise<void>;
    abstract onEnter(): Promise<void>;
    abstract onUpdate(deltaMS: number): void;
    abstract onExit(): Promise<void>;

    constructor(){
        super();

        this.assetLoader = new AssetLoader();
        this.viewInitializer = new ViewInitializer();
        this._loaded = false;
    }

    public get loaded(): boolean { return this._loaded; }

    /** Removes all views added by this screen from centralized layers. */
    public unload(){
        // Remove all views this screen added to layers
        for (const viewId of this.viewIds) {
            for (const layerId of this.layerManager.getLayerIds()) {
                try {
                    this.layerManager.getLayer(layerId).removeView(viewId);
                } catch {
                    // View might not be in this layer
                }
            }
        }
        this.viewIds = [];

        this.destroy({ children: true });
    }

    /** Called when canvas changes. Centralized layers handle their own layout updates. */
    public onLayoutChanged(canvas: DesignCanvas) {
        // Layers are managed centrally, they handle their own layout updates
        // Screen-specific layout logic can be added here if needed
    }

    /** Loads screen configuration by creating, initializing, and adding views to centralized layers. */
    protected async loadConfig(config: ScreenConfig, registry: ViewRegistry){
        const views = config.views.map(viewCfg =>
            ViewFactory.create(viewCfg.type, registry)
        );

        await this.assetLoader.loadForViews(views);

        this.viewInitializer.initializeAll(views, config.views);

        views.forEach((view, index) => {
            const viewCfg = config.views[index];

            const targetLayer = this.layerManager.getLayer(viewCfg.layer);
            targetLayer.addView(view.id, view, viewCfg);

            // Track view IDs for cleanup
            this.viewIds.push(view.id);
        });

        this._loaded = true;
    }

}
