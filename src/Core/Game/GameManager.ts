import { Application, Container, Size } from 'pixi.js';
import { Ticker } from 'pixi.js';

import { SingletonBase } from '../Abstractions/SingletonBase';
import { GameScene } from '../Abstractions/GameScene';
import { SplashScene } from './Scenes/SplashScene';
import { LayoutsSize, LayoutType } from '../Layout';

export class GameManager extends SingletonBase {
  private app!: Application;
  private currentScene?: GameScene;
  private layoutType!: LayoutType

  // 🔥 ROOT GLOBAL
  private rootLayer = new Container();

  // 🔥 LAYERS
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

    // Afegim root al stage
    this.app.stage.addChild(this.rootLayer);

    // Dins del root
    this.rootLayer.addChild(this.backgroundLayer);
    this.rootLayer.addChild(this.uiLayer);

    window.addEventListener('resize', this.onResize);
    this.checkDisplay();

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
      await this.currentScene.exit({ destroy: destroyPrevious });
      this.uiLayer.removeChild(this.currentScene);
    }

    this.currentScene = scene;
    this.uiLayer.addChild(scene);
    await scene.enter();
  }

  // 🔹 GETTERS
  public get application(): Application {
    return this.app;
  }

  public get bg(): Container {
    return this.backgroundLayer;
  }

  public get ui(): Container {
    return this.uiLayer;
  }

  public get gameSize(): Size {
    return LayoutsSize;
  }

  public get currentLayoutType(): LayoutType{
    return this.layoutType;
  }

  private checkDisplay(){
    const rawW = window.innerWidth;
    const rawH = window.innerHeight;

    // 🔹 flags separats
    this.layoutType = rawW < 768 ? "mobile" : "desktop";
    const aspect = rawH / rawW;
    const shouldRotate = aspect > 1.3;

    // dimensions virtuals per calcular escala
    const screenW = shouldRotate ? rawH : rawW;
    const screenH = shouldRotate ? rawW : rawH;

    // 🔥 CONTAIN GLOBAL
    const scale = Math.min(
      screenW / this.gameSize.width,
      screenH / this.gameSize.height
    );

    // 🔹 aplicar escala
    this.rootLayer.scale.set(scale);

    // reset
    this.rootLayer.rotation = 0;

    // 🔹 centrat base
    let posX = (rawW - this.gameSize.width * scale) * 0.5;
    let posY = (rawH - this.gameSize.height * scale) * 0.5;

    // 🔹 rotació només si cal
    if (shouldRotate) {
      this.rootLayer.rotation = Math.PI / 2;
      const rotatedW = this.gameSize.height * scale;
      const rotatedH = this.gameSize.width * scale;

      posX = rawW - (rawW - rotatedW) * 0.5;
      posY = (rawH - rotatedH) * 0.5;

    }

    this.rootLayer.position.set(posX, posY);   
  }

  // 🔥 RESIZE GLOBAL (CLAU)
  private onResize = () => {
    this.checkDisplay();
  };


}
