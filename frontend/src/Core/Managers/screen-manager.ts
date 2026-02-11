import { Application, Container } from 'pixi.js';
import { Ticker } from 'pixi.js';

import { SingletonBase } from '../Abstractions/singleton-base';
import { GameScreen } from '../Abstractions/game-screen';
import { SplashScreen } from '../Game/Screens/SplashScreen/splash-screen';

import { ScreenTypes } from '../Utils/utils';
import { View } from '../Abstractions/view';
import { BaseScreen } from '../Game/Screens/BaseScreen/base-screen';
import { BonusScreen } from '../Game/Screens/BonusScreen/bonus-screen';

import { DesignCanvas } from '../Layout/design-canvas';

export class ScreenManager extends SingletonBase {
  private _app!: Application;
  private _currentScreen?: GameScreen;
  private _root!: Container;

  private _sceneMap: Record<ScreenTypes, GameScreen | null> = {
    "SPLASH": null,
    "BASE": null,
    "BONUS": null
  }

  public transitionMap: Record<ScreenTypes, () => Promise<void>> = {
    SPLASH: () => this.changeScene("SPLASH", "BASE", true),
    BASE: () => this.changeScene("BASE", "BONUS", false),
    BONUS: () => this.changeScene("BONUS", "BASE", true)
  };

  protected constructor() {
    super();
  }

  public static get I(): ScreenManager {
    return super.getInstance<ScreenManager>();
  }

  public init(app: Application, root: Container): void {
    this._app = app;   
    this._root = root;
    this._app.ticker.add(this.update, this);
  }

  public async start(): Promise<void> {
    this._currentScreen = this.screenFactory("SPLASH");
    await this._currentScreen.load();
    await this._currentScreen.onEnter();

    this.scheduleTransitionToBase();
  }

  private scheduleTransitionToBase(): void {
    const preloadPromise = this.preloadScene("BASE");
    const minTimePromise = this.delay(2000);

    Promise.all([preloadPromise, minTimePromise]).then(() => {
      this.transitionMap.SPLASH();
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Preloads a scene during idle frames to avoid blocking the render loop. */
  private preloadScene(screenType: ScreenTypes): Promise<void> {
    const scene = this.screenFactory(screenType);
    this._sceneMap[screenType] = scene;

    return new Promise<void>(resolve => {
      const start = () => { scene.load().then(resolve); };

      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => start(), { timeout: 500 });
      } else {
        setTimeout(start, 0);
      }
    });
  }

  public onLayoutChanged(canvas: DesignCanvas): void {
    this._currentScreen?.onLayoutChanged(canvas);
  }
  
  private update(ticker: Ticker): void {
    this._currentScreen?.onUpdate(ticker.deltaMS);
  }

  private async changeScene(transitionFrom: ScreenTypes, transitionTo: ScreenTypes, destroyCurrent: boolean): Promise<void>{
    let pool: Map<string, View> | undefined;

    if(this._currentScreen){
      await this._currentScreen.onExit();
      if (destroyCurrent) {
        pool = this._currentScreen.releaseViews();
      } else {
        this._sceneMap[transitionFrom] = this._currentScreen;
      }
    }

    this._currentScreen = this._sceneMap[transitionTo] ?? this.screenFactory(transitionTo);
    if(!this._currentScreen.loaded){
      await this._currentScreen.load();
    }

    if (pool) {
      this._currentScreen.viewPool = pool;
    }

    await this._currentScreen.onEnter();
  }

  private screenFactory(screenKey: ScreenTypes): GameScreen{
    switch(screenKey){
        case "SPLASH":
          return new SplashScreen();
        case "BASE":
          return new BaseScreen();
        case "BONUS":
          return new BonusScreen();
        default:
          throw new Error(`Scene ${screenKey} does not exist`);
    }
  }
}

