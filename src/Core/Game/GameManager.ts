import { Application } from 'pixi.js';
import { Ticker } from 'pixi.js';

import { SingletonBase } from '../Abstractions/SingletonBase';

import { GameScene } from '../Abstractions/GameScene';
import { SplashScene } from './Scenes/SplashScene';

import { Assets } from 'pixi.js';

export class GameManager extends SingletonBase<GameManager> {
  private app!: Application;
  private currentScene?: GameScene;

  protected constructor() {
    super();
  }

  public init(app: Application): void {
    this.app = app;
    this.app.ticker.add(this.update, this);
  }

  public async start(): Promise<void> {
    const splash = new SplashScene();
    await this.changeScene(splash);

    //await Assets.loadBundle('base_core');

    // 3️⃣ BaseScene (quan la tinguis)
    // await this.changeScene(new BaseScene(), true);
  }

  private update(ticker: Ticker): void {
    const dtMs = ticker.deltaMS;
    this.currentScene?.update(dtMs);
  }

  public async changeScene(scene: GameScene, destroyPrevious = true): Promise<void> {
    if (this.currentScene) {
      this.currentScene.exit({ destroy: destroyPrevious });
      this.app.stage.removeChild(this.currentScene);
    }

    this.currentScene = scene;
    this.app.stage.addChild(scene);
    await scene.enter();
  }  

  public get application(): Application {
    return this.app;
  }
}
