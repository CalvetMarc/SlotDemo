import { Assets } from 'pixi.js';
import { GameScene } from '../../Abstractions/GameScene';
import { SplashView } from './SplashScene/SplashView';
import { LayoutsCompositions } from '../../Layout';
import { GameManager } from '../../Game/GameManager';
import { BackgroundView } from './SplashScene/BackgroundView';

export class SplashScene extends GameScene {
  private view!: SplashView;
  private background!: BackgroundView;

  protected onInit(): void {}

  protected async load(): Promise<void> {
    if (!Assets.cache.has('background')) {
      await Assets.loadBundle('boot');
    }

    // 🔴 BACKGROUND (fora del layout)
    this.background = new BackgroundView();
    this.background.init();
    GameManager.I.bg.addChild(this.background);

    // 🟦 UI
    this.view = new SplashView();
    this.view.init();
  }

  protected onEnter(): void {
    const layoutType = GameManager.I.layout;
    const splashLayout = LayoutsCompositions[layoutType].splash;

    this.view.applyLayout(splashLayout);

    // 🟦 UI va al uiLayer, NO a l'escena
    GameManager.I.ui.addChild(this.view);
  }

  protected onUpdate(): void {}
  protected onExit(): void {}

  protected onDestroy(): void {
    this.view.destroy();
    this.background.destroy();
  }
}
