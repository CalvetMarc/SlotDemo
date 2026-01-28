import { Container } from "pixi.js";
import { Layer } from "./Layer";
import { ViewRegistry } from "../Orchestors/ViewFactory";
import { ViewFactory } from "../Orchestors/ViewFactory";
import { ViewConfig } from "./View";
import { DesignCanvas } from "../Layout/DesignCanvas";
import { LayerFactory, LayerConfig } from "../Orchestors/LayerFactory";
import { AssetLoader } from "../Orchestors/AssetLoader";
import { ViewInitializer } from "../Orchestors/ViewInitializer";

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

/** Base class for all game screens with configurable layer system. */
export abstract class GameScreen extends Container implements IGameScreen {
    protected layers: Map<string, Layer>;
    private _loaded: boolean;

    private readonly assetLoader: AssetLoader;
    private readonly viewInitializer: ViewInitializer;

    abstract load(): Promise<void>;
    abstract onEnter(): Promise<void>;
    abstract onUpdate(deltaMS: number): void;
    abstract onExit(): Promise<void>;

    constructor(layerConfigs?: LayerConfig[]){
        super();

        this.assetLoader = new AssetLoader();
        this.viewInitializer = new ViewInitializer();

        const configs = layerConfigs ?? this.getDefaultLayers();

        this.layers = new Map();

        configs
            .sort((a, b) => a.zIndex - b.zIndex)
            .forEach(({ id, layer }) => {
                this.layers.set(id, layer);
                this.addChild(layer);
            });

        this._loaded = false;
    }

    /** Returns default layer configuration. Override to customize. */
    protected getDefaultLayers(): LayerConfig[] {
        return LayerFactory.createDefaultLayers();
    }

    /** Gets a layer by ID. Throws if not found. */
    protected getLayer(id: string): Layer {
        const layer = this.layers.get(id);
        if (!layer) {
            throw new Error(`Layer "${id}" not found in screen. Available layers: ${Array.from(this.layers.keys()).join(', ')}`);
        }
        return layer;
    }

    /** Checks if a layer exists. */
    protected hasLayer(id: string): boolean {
        return this.layers.has(id);
    }

    public get loaded(): boolean { return this._loaded; }

    /** Hides all layers. */
    public hibernate(){
        for (const layer of this.layers.values()) {
            layer.visible = false;
        }
    }

    /** Destroys all layers and cleans up. */
    public unload(){
        for (const layer of this.layers.values()) {
            layer.destroy({ children: true });
        }
        this.layers.clear();

        this.destroy({ children: true });
    }

    /** Called when canvas changes. Updates layout for all layers and their views. */
    public onLayoutChanged(canvas: DesignCanvas) {
        for (const layer of this.layers.values()) {
            layer.onLayoutChanged(canvas);
            layer.updateViewLayouts(canvas);
        }
    }

    /** Loads screen configuration by creating, initializing, and adding views to layers. */
    protected async loadConfig(config: ScreenConfig, registry: ViewRegistry){
        const views = config.views.map(viewCfg =>
            ViewFactory.create(viewCfg.type, registry)
        );

        await this.assetLoader.loadForViews(views);

        this.viewInitializer.initializeAll(views, config.views);

        views.forEach((view, index) => {
            const viewCfg = config.views[index];

            const targetLayer = this.layers.get(viewCfg.layer);
            if (!targetLayer) {
                throw new Error(
                    `Layer "${viewCfg.layer}" not found for view "${viewCfg.id}". ` +
                    `Available layers: ${Array.from(this.layers.keys()).join(', ')}`
                );
            }

            targetLayer.addView(view.id, view, viewCfg);
        });

        this._loaded = true;
    }

}
