import { Sprite, AnimatedSprite, Assets } from 'pixi.js';
import { BaseView } from '../../../Abstractions/BaseView';

type SplashLayout = {
  logo: { x: number; y: number };
  loading: { x: number; y: number };
};

export class SplashView extends BaseView {
  private logo!: Sprite;
  private loading?: AnimatedSprite;

  protected build(): void {
    this.logo = new Sprite(Assets.get('splash_logo'));
    this.logo.anchor.set(0.5);
    this.logo.scale.set(1);

    this.addChild(this.logo);

    if (Assets.cache.has('loading')) {
      const sheet = Assets.get('loading');
      this.loading = new AnimatedSprite(sheet.animations.loading);
      this.loading.anchor.set(0.5);
      this.loading.animationSpeed = -0.05;
      this.loading.play();
      this.loading.scale = 1.3;
      this.addChild(this.loading);
    }
  }

  public applyLayout(layout: SplashLayout): void {
    this.logo.position.set(layout.logo.x, layout.logo.y);

    if (this.loading) {
      this.loading.position.set(layout.loading.x, layout.loading.y);
    }
  }

  public destroy(options?: any): void {
    this.loading?.stop();
    super.destroy(options);
  }
}
