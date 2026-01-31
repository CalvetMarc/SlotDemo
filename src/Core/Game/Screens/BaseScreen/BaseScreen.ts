import { GameScreen, ScreenConfig } from "../../../Abstractions/GameScreen"
import { BASE_VIEW_REGISTRY } from "./config/BaseScene_loader";
import baseConfig from "./config/BaseScene_config.json"

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