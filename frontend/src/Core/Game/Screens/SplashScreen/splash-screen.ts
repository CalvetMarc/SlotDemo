import { GameScreen, ScreenConfig } from "../../../Abstractions/game-screen"
import { AudioManager } from "../../../Audio/audio-manager";
import { PressToContinueView } from "./views/press-to-continue-view";
import { LoadingGameView } from "./views/loading-game-view";

import { SPLASH_VIEW_REGISTRY } from "./config/splash-scene-loader";
import splashConfig from "./config/splash-scene-config.json"

export class SplashScreen extends GameScreen{
    private _hintView: PressToContinueView | null = null;
    private _loadingView: LoadingGameView | null = null;

    constructor(){
        super();
    }

    async load(): Promise<void> {
        await this.loadConfig(splashConfig as ScreenConfig, SPLASH_VIEW_REGISTRY);
    }

    async onEnter(): Promise<void> {
        this.addViewsToLayers();

        const gameViews = this.layerManager.getLayer('game').getViews();
        this._hintView = (gameViews['press_to_continue'] as unknown as PressToContinueView) ?? null;
        this._loadingView = (gameViews['loading'] as unknown as LoadingGameView) ?? null;

    }

    showPressToContinue(): void {
        if (this._loadingView) {
            this._loadingView.visible = false;
        }
        this._hintView?.show();
    }

    onUpdate(deltaMS: number): void {
        this._hintView?.update(deltaMS);
    }

    async onExit(): Promise<void> {
    }

}