import { GameScreen, ScreenConfig } from "../../../Abstractions/game-screen"
import { BASE_VIEW_REGISTRY } from "./config/base-scene-loader";
import baseConfig from "./config/base-scene-config.json"

export class BaseScreen extends GameScreen{

    constructor(){
        super();
    }

    async load(): Promise<void> {
        await this.loadConfig(baseConfig as ScreenConfig, BASE_VIEW_REGISTRY);
    }

    async onEnter(): Promise<void> {
        this.addViewsToLayers();
    }

    onUpdate(deltaMS: number): void {
    }

    async onExit(): Promise<void> {
    }

}