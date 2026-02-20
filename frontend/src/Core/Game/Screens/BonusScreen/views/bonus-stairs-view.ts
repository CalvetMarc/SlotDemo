import { Sprite } from 'pixi.js';
import { bundle, View } from '../../../../Abstractions/view';

export class BonusStairsView extends View {
    private _sprite!: Sprite;

    bundleNeeded(): bundle {
        return 'bonus';
    }

    appear(): void {
        this._sprite = Sprite.from('bonus_stairs');
        this.addChild(this._sprite);
    }
}
