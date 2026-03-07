import { ButtonView } from "../../Abstractions/button-view";
import { bundle } from "../../Abstractions/view";
import { Sprite, Assets, Graphics } from "pixi.js";
import { AudioManager } from "../../Audio/audio-manager";

export class AudioButtonView extends ButtonView {
    private background!: Graphics;
    private iconSprite!: Sprite;
    private _isOn: boolean = true;

    // Debug mode - set to true to see hit bounds
    public static DEBUG_BOUNDS: boolean = false;

    // Button size (radius)
    private static RADIUS: number = 40;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        const sheet = Assets.get('ui_icons');

        // Background circle - Dark magical theme
        this.background = new Graphics();
        this.background.circle(0, 0, AudioButtonView.RADIUS);
        this.background.fill({ color: 0x1a1f2e });  // Deep blue-gray
        this.background.stroke({ color: 0x2a3345, width: 3 });  // Subtle blue border
        this.addChild(this.background);

        // Icon - soft off-white
        this.iconSprite = new Sprite(sheet.textures['volumeOn.png']);
        this.iconSprite.anchor.set(0.5);
        this.iconSprite.tint = 0xc8cdd8;  // Soft off-white
        this.iconSprite.scale.set(0.3);
        this.addChild(this.iconSprite);

        // Sync initial state with AudioManager
        this._isOn = !AudioManager.isMuted;
        this.iconSprite.texture = sheet.textures[this._isOn ? 'volumeOn.png' : 'volumeOff.png'];

        this.showDebugBounds(AudioButtonView.DEBUG_BOUNDS);
        this.setupInteractivity();
    }

    protected playClickSfx(): void {
        // Will mute → negative, will unmute → positive
        AudioManager.play(this._isOn ? 'negativeClick' : 'positiveClick');
    }

    onMouseClick(): void {
        const isMuted = AudioManager.toggleMute();
        this.setOn(!isMuted);
    }

    public setOn(on: boolean): void {
        this._isOn = on;
        const sheet = Assets.get('ui_icons');
        this.iconSprite.texture = sheet.textures[on ? 'volumeOn.png' : 'volumeOff.png'];
    }

    public getIsOn(): boolean {
        return this._isOn;
    }
}
