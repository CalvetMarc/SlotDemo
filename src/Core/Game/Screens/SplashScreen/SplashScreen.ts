import { GameScreen, ScreenConfig } from "../../../Abstractions/GameScreen"

import { SPLASH_VIEW_REGISTRY } from "./config/SplashScene_loader";
import splashConfig from "./config/SplashScene_config.json"

export class SplashScreen extends GameScreen{
    constructor(){
        super();
    }

    async load(): Promise<void> {        
        await this.loadConfig(splashConfig as ScreenConfig, SPLASH_VIEW_REGISTRY);
    }

    async onEnter(): Promise<void> {        
    }

    onUpdate(deltaMS: number): void {
    }
    
    async onExit(): Promise<void> {
    }

}