import { Application, Container } from 'pixi.js';
import { Ticker } from 'pixi.js';

import { SingletonBase } from '../Abstractions/SingletonBase';
import { GameScreen } from '../Abstractions/GameScreen';
import { SplashScreen } from '../Game/Screens/SplashScreen/SplashScreen';

import { ScreenTypes } from '../Utils/utils';
import { BaseScreen } from '../Game/Screens/BaseScreen/BaseScreen';
import { BonusScreen } from '../Game/Screens/BonusScreen';

import { DesignCanvas } from '../Layout/DesignCanvas';

export class ScreenManager extends SingletonBase {
  private app!: Application;
  private currentScreen?: GameScreen;
  private root!: Container;

  private sceneMap: Record<ScreenTypes, GameScreen | null> = {
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
    this.app = app;   
    this.root = root;
    this.app.ticker.add(this.update, this);
  }

  public async start(): Promise<void> {
    this.currentScreen = this.screenFactory("SPLASH");
    await this.currentScreen.load();
    await this.currentScreen.onEnter();

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
    this.sceneMap[screenType] = scene;

    return new Promise(resolve => {
      const load = () => scene.load().then(resolve);

      if (window.requestIdleCallback) {
        window.requestIdleCallback(load);
      } else {
        setTimeout(load, 0);
      }
    });
  }

  public onLayoutChanged(canvas: DesignCanvas): void {
    this.currentScreen?.onLayoutChanged(canvas);
  }
  
  private update(ticker: Ticker): void {
    this.currentScreen?.onUpdate(ticker.deltaMS);
  }

  private async changeScene(transitionFrom: ScreenTypes, transitionTo: ScreenTypes, destroyCurrent: boolean): Promise<void>{
    if(this.currentScreen){
      await this.currentScreen.onExit();            
      destroyCurrent ? this.currentScreen.unload() : this.sceneMap[transitionFrom] = this.currentScreen;            
    }

    this.currentScreen = this.sceneMap[transitionTo] ?? this.screenFactory(transitionTo);
    if(!this.currentScreen.loaded){
      await this.currentScreen.load();
    }

    await this.currentScreen.onEnter();   
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

