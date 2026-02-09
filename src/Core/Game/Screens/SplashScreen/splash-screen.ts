import { GameScreen, ScreenConfig } from "../../../Abstractions/game-screen"

import { SPLASH_VIEW_REGISTRY } from "./config/splash-scene-loader";
import splashConfig from "./config/splash-scene-config.json"

export class SplashScreen extends GameScreen{
    constructor(){
        super();
    }

    async load(): Promise<void> {        
        await this.loadConfig(splashConfig as ScreenConfig, SPLASH_VIEW_REGISTRY);
    }

    async onEnter(): Promise<void> {
        this.addViewsToLayers();
    }

    onUpdate(deltaMS: number): void {
    }
    
    async onExit(): Promise<void> {
    }

}