import { Assets } from 'pixi.js';
import { GameScene } from '../../Abstractions/GameScene';
import { SplashView } from './SplashScene/SplashView';

export class SplashScene extends GameScene {
  private view!: SplashView;

  protected onInit(): void {}

  protected async load(): Promise<void> {
    if (!Assets.cache.has('background')) {
        await Assets.loadBundle('boot');
    }

    this.view = new SplashView();
    this.view.init();
  }

  protected onEnter(): void {    
    this.addChild(this.view);
  }

  protected onUpdate(): void {}

  protected onExit(): void {}

  protected onDestroy(): void {
    this.view.destroy();
  }
}
