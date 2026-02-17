import { Application, Assets, Container } from 'pixi.js';
import { Ticker } from 'pixi.js';

import { SingletonBase } from '../Abstractions/singleton-base';
import { GameScreen } from '../Abstractions/game-screen';
import { SplashScreen } from '../Game/Screens/SplashScreen/splash-screen';

import { ScreenTypes } from '../Utils/utils';
import { View } from '../Abstractions/view';
import { BaseScreen } from '../Game/Screens/BaseScreen/base-screen';
import { BonusScreen } from '../Game/Screens/BonusScreen/bonus-screen';

import { DesignCanvas } from '../Layout/design-canvas';
import { TransitionMask } from '../Transitions/transition-mask';
import { gameSignals } from '../Signals/game-signals';
import { SessionManager } from '../Game/SlotMachine/session-manager';

const SCREEN_REGISTRY: Record<ScreenTypes, () => GameScreen> = {
  SPLASH: () => new SplashScreen(),
  BASE: () => new BaseScreen(),
  BONUS: () => new BonusScreen(),
};

export class ScreenManager extends SingletonBase {
  private _app!: Application;
  private _currentScreen?: GameScreen;
  private _root!: Container;
  private _transitionMask!: TransitionMask;

  private _sceneMap: Record<ScreenTypes, GameScreen | null> = {
    "SPLASH": null,
    "BASE": null,
    "BONUS": null
  }

  public transitionMap: Record<ScreenTypes, () => Promise<void>> = {
    SPLASH: () => this.changeScene("SPLASH", "BASE", true),
    BASE: () => this.changeScene("BASE", "BONUS", false, true),
    BONUS: () => this.changeScene("BONUS", "BASE", true, true)
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

    this._transitionMask = new TransitionMask();
    this._app.stage.addChild(this._transitionMask);

    gameSignals.sessionExpired.connect(() => this._onSessionExpired());
    gameSignals.requestBonusTransition.connect(() => this.transitionMap.BASE());
    gameSignals.requestBaseTransition.connect(() => this.transitionMap.BONUS());
  }

  public get transitionMask(): TransitionMask {
    return this._transitionMask;
  }

  public async start(): Promise<void> {
    this._currentScreen = this.screenFactory("SPLASH");
    await this._currentScreen.load();
    await this._currentScreen.onEnter();

    this.scheduleTransitionToBase();
  }

  private scheduleTransitionToBase(): void {
    const preloadPromise = this.preloadScene("BASE");
    const winPreload = Assets.loadBundle('win');
    const infoPreload = Assets.loadBundle('info');
    const minTimePromise = this.delay(2000);

    Promise.all([preloadPromise, winPreload, infoPreload, minTimePromise]).then(() => {
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

  private async changeScene(
    transitionFrom: ScreenTypes,
    transitionTo: ScreenTypes,
    destroyCurrent: boolean,
    useMask = false,
  ): Promise<void> {
    if (useMask) {
      // Kick off asset loading NOW so it runs in parallel with the fadeIn video.
      const loadPromise = this._ensureLoaded(transitionTo);

      const { width, height } = this._app.screen;
      await this._transitionMask.playTransition(width, height, async () => {
        // By the time fadeIn finishes the load is likely done; if not, wait here.
        await loadPromise;
        await this._swapScene(transitionFrom, transitionTo, destroyCurrent);
      });
    } else {
      await this._swapScene(transitionFrom, transitionTo, destroyCurrent);
    }
  }

  /** Makes sure the target screen is created and its assets loaded. */
  private async _ensureLoaded(screenType: ScreenTypes): Promise<void> {
    if (!this._sceneMap[screenType]) {
      this._sceneMap[screenType] = this.screenFactory(screenType);
    }
    const screen = this._sceneMap[screenType]!;
    if (!screen.loaded) {
      await screen.load();
    }
  }

  private async _swapScene(
    transitionFrom: ScreenTypes,
    transitionTo: ScreenTypes,
    destroyCurrent: boolean,
  ): Promise<void> {
    let pool: Map<string, View> | undefined;

    if (this._currentScreen) {
      await this._currentScreen.onExit();
      if (destroyCurrent) {
        pool = this._currentScreen.releaseViews();
      } else {
        this._sceneMap[transitionFrom] = this._currentScreen;
      }
    }

    this._currentScreen = this._sceneMap[transitionTo] ?? this.screenFactory(transitionTo);
    if (!this._currentScreen.loaded) {
      await this._currentScreen.load();
    }

    if (pool) {
      this._currentScreen.viewPool = pool;
    }

    await this._currentScreen.onEnter();
  }

  private async _onSessionExpired(): Promise<void> {
    // Exit and destroy current screen so views are disposed (removes ticker/signal listeners)
    if (this._currentScreen) {
      await this._currentScreen.onExit();
      this._currentScreen.unload();
    }

    // Clear cached scenes so they are recreated fresh
    for (const key of Object.keys(this._sceneMap) as ScreenTypes[]) {
      this._sceneMap[key] = null;
    }
    this._currentScreen = undefined;

    // Create a fresh session and restart from splash
    await SessionManager.init();
    await this.start();
  }

  private screenFactory(screenKey: ScreenTypes): GameScreen {
    const factory = SCREEN_REGISTRY[screenKey];
    return factory();
  }
}

