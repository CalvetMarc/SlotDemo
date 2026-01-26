import { Assets, Container } from "pixi.js";
import { Layer } from "./Layer";
import { BackgroundLayer } from "../Game/Layers/BackgroundLayer";
import { UiLayer } from "../Game/Layers/UiLayer";
import { GameLayer } from "../Game/Layers/GameLayer";
import { ViewRegistry } from "../Orchestors/ViewFactory";
import { ViewFactory } from "../Orchestors/ViewFactory";
import { ViewConfig } from "./View";
import { Transform } from "../Utils/Transform";

export interface IGameScreen {
    load(): void;
    onEnter(): Promise<void>;
    onUpdate(deltaMS: number): void;
    onExit(): Promise<void>;
    unload(): void;
}

export type LayerId = "background" | "game" | "ui";

export interface ScreenConfig {
    scene: string;
    views: ViewConfig[];
}

export abstract class GameScreen extends Container implements IGameScreen {
    protected layers: Record<LayerId, Layer>;
    private _loaded: boolean;

    abstract load(): void;
    abstract onEnter(): Promise<void>;
    abstract onUpdate(deltaMS: number): void;
    abstract onExit(): Promise<void>;

    constructor(layers?: Partial<Record<LayerId, Layer>>){
        super();

        this.layers = {
            background: layers?.background ?? new BackgroundLayer(),
            game: layers?.game ?? new GameLayer(),
            ui: layers?.ui ?? new UiLayer()
        };

        this.addChild(this.layers.background);
        this.addChild(this.layers.game);
        this.addChild(this.layers.ui);

        this._loaded = false;
    }    

    public get loaded(): boolean { return this._loaded; }


    public hibernate(){
        //TODO: HIDE VIEWS
    }

    public unload(){
        //TODO: FREE RESOURCES


        this.destroy( { children: true } );
    }

    protected async loadConfig(config: ScreenConfig, registry: ViewRegistry){
        for (const viewCfg of config.views) {
            const view = ViewFactory.create(viewCfg.type, registry);
            if(!Assets.cache.has(view.bundleNeeded())){
                await Assets.loadBundle(view.bundleNeeded())
            }
            view.appear();
            
            view.id = viewCfg.id;

            this.layers[viewCfg.layer as LayerId].addView(view.id, view);

            const transform = new Transform(viewCfg.transform);
            transform.applyTo(view);            
        }

        this._loaded = true;
    }

}