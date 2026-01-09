import { Sprite, Container } from "pixi.js";
import { GameManager } from "../../GameManager";

export class BackgroundView extends Container {
  private bg!: Sprite;
  private fog!: Sprite;

  public init(): void {
    this.bg = Sprite.from('background');
    this.fog = Sprite.from('fog');

    this.bg.anchor.set(0.5);
    this.fog.anchor.set(0.5);

    const gm = GameManager.I;

    // SEMPRE centre del món
    this.bg.position.set(
      gm['designWidth'] * 0.5,
      gm['designHeight'] * 0.5
    );

    this.fog.position.copyFrom(this.bg.position);

    this.addChild(this.bg, this.fog);
  }
}
