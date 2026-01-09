import { Container } from 'pixi.js';

export abstract class BaseView extends Container {
  protected abstract build(): void;

  public init(): void {
    this.build();
  }

  public show(): void {
    this.visible = true;
  }

  public hide(): void {
    this.visible = false;
  }

  public destroy(options?: any): void {
    super.destroy(options);
  }
}
