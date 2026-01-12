import { Sprite, Container } from "pixi.js";
import { GameManager } from "../../GameManager";

export class BackgroundView extends Container {
  private bg!: Sprite;
  private fog!: Sprite;

  public init(): void {
    this.bg = Sprite.from('background');
    this.fog = Sprite.from('fog');

    // 👈 clau
    this.bg.anchor.set(0.5);
    this.fog.anchor.set(0.5);

    // 👈 el container es col·loca al centre del món
    this.position.set(GameManager.I.gameSize.width * 0.5, GameManager.I.gameSize.height * 0.5);

    this.bg.position.set(0, 0);
    this.fog.position.set(0, 0);

    this.addChild(this.bg, this.fog);
  }
}
