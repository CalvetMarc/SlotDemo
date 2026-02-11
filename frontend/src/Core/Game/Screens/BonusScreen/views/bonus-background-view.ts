import { Sprite } from 'pixi.js';
import { bundle, View } from '../../../../Abstractions/view';

export class BonusBackgroundView extends View {
    private _sprite!: Sprite;

    bundleNeeded(): bundle {
        return 'bonus';
    }

    appear(): void {
        this._sprite = Sprite.from('bonus_bg');
        this.addChild(this._sprite);
    }
}
