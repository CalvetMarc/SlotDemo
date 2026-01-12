import { Container } from 'pixi.js';
import { Ticker } from 'pixi.js';

export abstract class GameScene extends Container {
  private loaded = false;

  protected abstract load(): Promise<void>;
  protected abstract onInit(): void;
  protected abstract onEnter(): void;
  protected abstract onUpdate(dtMs: number): void;
  protected abstract onExit(): void;
  protected abstract onDestroy(): void;

  constructor() {
    super();
    this.onInit();
  }

  public async enter() {
    if (!this.loaded) {
      await this.load();
      this.loaded = true;
    }
    this.onEnter();
  }

  public async exit(options?: { destroy?: boolean }) {
    this.onExit();

    if (options?.destroy) {
      this.onDestroy();
      this.destroy({ children: true });
    }
  }

  public update(dtMs: number) {
    this.onUpdate(dtMs);
  }
}
