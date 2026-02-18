import { AnimatedSprite, Assets, Sprite, Texture } from 'pixi.js';
import { bundle, View } from '../../../../Abstractions/view';

export class ChestView extends View {
    private _closedSprite!: Sprite;
    private _openAnim!: AnimatedSprite;
    private _isOpened = false;
    private _chestIndex = -1;
    private _onPick?: (index: number) => void;

    bundleNeeded(): bundle {
        return 'bonus';
    }

    appear(): void {
        const sheet0 = Assets.get('chest_animated_0');
        const sheet1 = Assets.get('chest_animated_1');
        const getTexture = (name: string): Texture =>
            sheet0.textures[name] ?? sheet1.textures[name];

        // Closed state: first frame of the animation
        this._closedSprite = new Sprite(getTexture('chest_01.png'));
        this._closedSprite.anchor.set(0.5);
        this.addChild(this._closedSprite);

        // Open animation: build frames from both spritesheets
        const frames: Texture[] = [];
        for (let i = 1; i <= 23; i++) {
            const name = `chest_${i.toString().padStart(2, '0')}.png`;
            const tex = getTexture(name);
            if (tex) frames.push(tex);
        }

        this._openAnim = new AnimatedSprite(frames);
        this._openAnim.anchor.set(0.5);
        this._openAnim.animationSpeed = 0.4;
        this._openAnim.loop = false;
        this._openAnim.visible = false;
        this.addChild(this._openAnim);

        // Interactive
        this.eventMode = 'static';
        this.cursor = 'pointer';
        this.on('pointertap', this._handleTap, this);
    }

    setup(chestIndex: number, onPick: (index: number) => void): void {
        this._chestIndex = chestIndex;
        this._onPick = onPick;
        this._isOpened = false;
        this._closedSprite.visible = true;
        this._openAnim.visible = false;
        this._openAnim.gotoAndStop(0);
        this.eventMode = 'static';
        this.cursor = 'pointer';
        this.alpha = 1;
    }

    playOpen(): Promise<void> {
        return new Promise((resolve) => {
            this._isOpened = true;
            this.eventMode = 'none';
            this.cursor = 'default';
            this._closedSprite.visible = false;
            this._openAnim.visible = true;
            this._openAnim.gotoAndPlay(0);
            this._openAnim.onComplete = () => resolve();
        });
    }

    disable(): void {
        this.eventMode = 'none';
        this.cursor = 'default';
        this.alpha = 0.5;
    }

    private _handleTap(): void {
        if (this._isOpened) return;
        this._onPick?.(this._chestIndex);
    }

    protected dispose(): void {
        this.off('pointertap', this._handleTap, this);
    }
}
