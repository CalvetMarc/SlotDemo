import { Application, Container, Size } from 'pixi.js';
import { Ticker } from 'pixi.js';

import { SingletonBase } from '../Abstractions/SingletonBase';
import { GameScene } from '../Abstractions/GameScene';
import { SplashScene } from './Scenes/SplashScene';

import { LayoutType, LayoutsSize } from '../Layout';

export class GameManager extends SingletonBase {
  private app!: Application;
  private currentScene?: GameScene;

  private layoutType!: LayoutType;
  private designWidth!: number;
  private designHeight!: number;

  // 🔥 LAYERS SEPARATS
  private backgroundLayer = new Container();
  private uiLayer = new Container();

  protected constructor() {
    super();
  }

  public static get I(): GameManager {
    return super.getInstance<GameManager>();
  }

  public init(app: Application): void {
    this.app = app;

    // Layout inicial
    this.layoutType = window.innerWidth < 768 ? 'mobile' : 'desktop';

    const size = LayoutsSize[this.layoutType];
    this.designWidth = size.width;
    this.designHeight = size.height;

    // Afegim layers a l'stage
    this.app.stage.addChild(this.backgroundLayer);
    this.app.stage.addChild(this.uiLayer);

    window.addEventListener('resize', this.onResize);
    this.onResize();

    this.app.ticker.add(this.update, this);
  }

  public async start(): Promise<void> {
    const splash = new SplashScene();
    await this.changeScene(splash);
  }

  private update(ticker: Ticker): void {
    const dtMs = ticker.deltaMS;
    this.currentScene?.update(dtMs);
  }

  public async changeScene(scene: GameScene, destroyPrevious = true): Promise<void> {
    if (this.currentScene) {
      this.currentScene.exit({ destroy: destroyPrevious });
      this.uiLayer.removeChild(this.currentScene);
    }

    this.currentScene = scene;
    this.uiLayer.addChild(scene);
    await scene.enter();
  }

  // 🔹 GETTERS ÚTILS
  public get application(): Application {
    return this.app;
  }

  public get layout(): LayoutType {
    return this.layoutType;
  }

  public get bg(): Container {
    return this.backgroundLayer;
  }

  public get ui(): Container {
    return this.uiLayer;
  }

  public get width(): number {
    return this.designWidth;
  }

  public get height(): number {
    return this.designHeight;
  }

  // 🔥 AQUEST ÉS EL COR DEL SISTEMA
  private onResize = () => {
    this.layoutType = window.screen.width < 768 ? 'mobile' : 'desktop';

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // =========================
    // 🟦 UI → CONTAIN (igual que abans)
    // =========================
    const uiScale = Math.min(
      screenW / this.designWidth,
      screenH / this.designHeight
    );

    this.uiLayer.scale.set(uiScale);
    this.uiLayer.position.set(
      (screenW - this.designWidth * uiScale) * 0.5,
      (screenH - this.designHeight * uiScale) * 0.5
    );

    // =========================
    // 🟥 BACKGROUND → regla teva
    // =========================

    let bgScale: Size = {width: 0, height: 0};

    if (this.layoutType === 'desktop') {
      // Desktop → encaixar en horitzontal
      bgScale.width = screenW / 2500;
      bgScale.height = bgScale.width;
    } else {
      // Mobile → encaixar en vertical
      bgScale.height = screenH / 1583;
      bgScale.width = bgScale.height;
    }   

    this.backgroundLayer.scale.set(bgScale.width, bgScale.height);

    this.backgroundLayer.position.set(
      (screenW - this.designWidth * bgScale.width) * 0.5,
      (screenH - this.designHeight * bgScale.height) * 0.5
    );
  }; 

}
