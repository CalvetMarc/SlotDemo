import { ButtonView } from "../../Abstractions/button-view";
import { bundle } from "../../Abstractions/view";
import { Sprite, Assets, Graphics, Container, Text, TextStyle } from "pixi.js";
import { GameModel } from "../SlotMachine/game-model";
import { AudioManager } from "../../Audio/audio-manager";

const ACTIVE_COLOR = 0x00e8b8;
const MUTED_COLOR = 0x8899aa;
const ICON_MUTED = 0xc8cdd8;

export class TurboButtonView extends ButtonView {
    private iconSprite!: Sprite;
    private _picker!: Container;
    private _pickerBg!: Graphics;
    private _toggleSprite!: Sprite;
    private _toggleLabel!: Text;
    private _isPickerVisible = false;
    private _ignoreDismiss = false;
    private _dismissHandler?: () => void;

    // Debug mode - set to true to see hit bounds
    public static DEBUG_BOUNDS: boolean = false;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        // Icon only (background is in SpinControlsView bar) - soft off-white
        const sheet = Assets.get('ui_icons');
        this.iconSprite = new Sprite(sheet.textures['turboOff.png']);
        this.iconSprite.anchor.set(0.5);
        this.iconSprite.tint = ICON_MUTED;
        this.iconSprite.scale.set(0.3);
        this.addChild(this.iconSprite);

        this._buildPicker();

        this.showDebugBounds(TurboButtonView.DEBUG_BOUNDS);
        this.setupInteractivity();
    }

    protected playClickSfx(): void {
        AudioManager.play(GameModel.isTurbo ? 'negativeClick' : 'positiveClick');
    }

    onMouseClick(): void {
        this._ignoreDismiss = true;
        if (GameModel.isTurbo) {
            // Turning OFF: just deactivate, hide picker
            this.setActive(false);
            this.hidePicker();
        } else {
            // Turning ON: activate and show picker
            this.setActive(true);
            this._showPicker();
        }
    }

    public setActive(active: boolean): void {
        GameModel.setTurbo(active);
        this.iconSprite.tint = active ? ACTIVE_COLOR : ICON_MUTED;
    }

    public getActive(): boolean {
        return GameModel.isTurbo;
    }

    public getPickerContainer(): Container {
        return this._picker;
    }

    public isPickerOpen(): boolean {
        return this._isPickerVisible;
    }

    public hidePicker(): void {
        if (!this._isPickerVisible) return;
        this._isPickerVisible = false;
        this._picker.visible = false;
        this._removeDismissHandler();
    }

    protected override dispose(): void {
        this._removeDismissHandler();
    }

    private _showPicker(): void {
        this._isPickerVisible = true;
        this._picker.visible = true;
        this._addDismissHandler();
    }

    private _addDismissHandler(): void {
        this._removeDismissHandler();
        this._dismissHandler = () => {
            if (this._ignoreDismiss) {
                this._ignoreDismiss = false;
                return;
            }
            this.hidePicker();
        };
        window.addEventListener('pointerdown', this._dismissHandler);
    }

    private _removeDismissHandler(): void {
        if (this._dismissHandler) {
            window.removeEventListener('pointerdown', this._dismissHandler);
            this._dismissHandler = undefined;
        }
    }

    private _buildPicker(): void {
        this._picker = new Container();
        this._picker.visible = false;

        const PAD_X = 16;
        const PAD_Y = 12;

        // Label
        this._toggleLabel = new Text({
            text: 'Skip Screens',
            style: new TextStyle({
                fontFamily: 'Arial',
                fontSize: 18,
                fontWeight: 'bold',
                fill: MUTED_COLOR,
            }),
        });
        this._toggleLabel.anchor.set(0, 0.5);

        // Toggle icon
        const sheet = Assets.get('ui_icons');
        const texName = GameModel.isSkipScreens ? 'toggleAutoOn.png' : 'toggleAutoOff.png';
        this._toggleSprite = new Sprite(sheet.textures[texName]);
        this._toggleSprite.anchor.set(0.5);
        this._toggleSprite.scale.set(0.25);
        this._toggleSprite.tint = GameModel.isSkipScreens ? ACTIVE_COLOR : 0xffffff;

        // Layout: label left, toggle right
        const GAP = 12;
        const toggleW = this._toggleSprite.width;
        const contentW = this._toggleLabel.width + GAP + toggleW;
        const contentH = Math.max(this._toggleLabel.height, this._toggleSprite.height);
        const totalW = contentW + PAD_X * 2;
        const totalH = contentH + PAD_Y * 2;

        // Background
        this._pickerBg = new Graphics();
        this._pickerBg.roundRect(-totalW / 2, -totalH, totalW, totalH, 12);
        this._pickerBg.fill({ color: 0x1a2233 });
        this._pickerBg.stroke({ color: 0x3a4d66, width: 2 });
        this._picker.addChild(this._pickerBg);

        // Position label + toggle centered in the bg
        const startX = -contentW / 2;
        const centerY = -totalH / 2;

        this._toggleLabel.position.set(startX, centerY);
        this._picker.addChild(this._toggleLabel);

        this._toggleSprite.position.set(startX + this._toggleLabel.width + GAP + toggleW / 2, centerY);
        this._picker.addChild(this._toggleSprite);

        // Interactivity on bg to prevent dismiss
        this._pickerBg.eventMode = 'static';
        this._pickerBg.on('pointerdown', (e) => {
            e.stopPropagation();
            this._ignoreDismiss = true;
        });

        // Toggle click
        this._toggleSprite.eventMode = 'static';
        this._toggleSprite.cursor = 'pointer';
        this._toggleSprite.on('pointerdown', (e) => {
            e.stopPropagation();
            this._ignoreDismiss = true;
            this._onToggleClick();
        });

        // Label also clickable
        this._toggleLabel.eventMode = 'static';
        this._toggleLabel.cursor = 'pointer';
        this._toggleLabel.on('pointerdown', (e) => {
            e.stopPropagation();
            this._ignoreDismiss = true;
            this._onToggleClick();
        });
    }

    private _onToggleClick(): void {
        const newState = !GameModel.isSkipScreens;
        GameModel.setSkipScreens(newState);
        AudioManager.play(newState ? 'positiveClick' : 'negativeClick');

        // Update toggle visual — blue tint when active
        const sheet = Assets.get('ui_icons');
        this._toggleSprite.texture = sheet.textures[newState ? 'toggleAutoOn.png' : 'toggleAutoOff.png'];
        this._toggleSprite.tint = newState ? ACTIVE_COLOR : 0xffffff;
    }
}
