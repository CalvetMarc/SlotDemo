import { Assets } from "pixi.js";
import { GameScreen, ScreenConfig } from "../../../Abstractions/game-screen"
import { BASE_VIEW_REGISTRY } from "./config/base-scene-loader";
import baseConfig from "./config/base-scene-config.json"

export class BaseScreen extends GameScreen{

    constructor(){
        super();
    }

    async load(): Promise<void> {
        await Promise.all([
            this.loadConfig(baseConfig as ScreenConfig, BASE_VIEW_REGISTRY),
            Assets.loadBundle('win'),
        ]);
    }

    async onEnter(): Promise<void> {
        if (this.isDetached) {
            this.reattachViews();
        } else {
            this.addViewsToLayers();
        }
    }

    onUpdate(deltaMS: number): void {
    }

    async onExit(): Promise<void> {
    }

}