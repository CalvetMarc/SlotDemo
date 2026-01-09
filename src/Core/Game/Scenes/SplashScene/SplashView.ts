import { Sprite, AnimatedSprite, Assets } from 'pixi.js';
import { BaseView } from '../../../Abstractions/BaseView';

export class SplashView extends BaseView {
  private background!: Sprite;
  private logo!: Sprite;
  private loading?: AnimatedSprite;

  protected build(): void {
    this.background = Sprite.from('background');
    this.logo = Sprite.from('splash_logo');

    this.background.anchor.set(0.5);
    this.logo.anchor.set(0.5);

    this.background.position.set(960, 540);
    this.logo.position.set(960, 420);

    this.addChild(this.background, this.logo);

    if (Assets.cache.has('loading')) {
      const sheet = Assets.get('loading');
      this.loading = new AnimatedSprite(sheet.animations.loading);
      this.loading.anchor.set(0.5);
      this.loading.position.set(960, 650);
      this.loading.animationSpeed = 0.4;
      this.loading.play();

      this.addChild(this.loading);
    }
  }

  public destroy(options?: any): void {
    this.loading?.stop();
    super.destroy(options);
  }
}
