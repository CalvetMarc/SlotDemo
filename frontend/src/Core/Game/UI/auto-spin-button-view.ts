import { ButtonView } from "../../Abstractions/button-view";
import { bundle } from "../../Abstractions/view";
import { Sprite, Assets, Graphics, Container, Text, TextStyle } from "pixi.js";
import { GameModel } from "../SlotMachine/game-model";

const PICKER_VALUES = [0, 10, 20, 50, 100, 250, 500] as const;
const ACTIVE_COLOR = 0x00e8b8;
const HOVER_COLOR = 0xffffff;
const MUTED_COLOR = 0x8899aa;
const ICON_MUTED = 0xc8cdd8;

export class AutoSpinButtonView extends ButtonView {
    private iconSprite!: Sprite;
    private _picker!: Container;
    private _pickerBg!: Graphics;
    private _pickerTexts: Text[] = [];
    private _miniPill!: Container;
    private _miniPillBg!: Graphics;
    private _miniPillText!: Text;
    private _selectedCount = 0;
    private _isPickerVisible = false;
    private _ignoreDismiss = false;
    private _dismissHandler?: () => void;

    public static DEBUG_BOUNDS: boolean = false;

    bundleNeeded(): bundle {
        return "base";
    }

    appear(): void {
        const sheet = Assets.get('ui_icons');
        this.iconSprite = new Sprite(sheet.textures['auto.png']);
        this.iconSprite.anchor.set(0.5);
        this.iconSprite.tint = ICON_MUTED;
        this.iconSprite.scale.set(0.3);
        this.addChild(this.iconSprite);

        this._buildPicker();
        this._buildMiniPill();

        this.showDebugBounds(AutoSpinButtonView.DEBUG_BOUNDS);
        this.setupInteractivity();
    }

    protected applyHoverTint(): void {
        this.iconSprite.alpha = 0.6;
    }

    protected removeHoverTint(): void {
        this.iconSprite.alpha = 1;
    }

    onMouseClick(): void {
        this._ignoreDismiss = true;
        if (GameModel.autoSpinRemaining > 0) {
            GameModel.setAutoSpinRemaining(0);
            return;
        }
        this._togglePicker();
    }

    public getSelectedCount(): number {
        return this._selectedCount;
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
        this._refreshMiniPill();
    }

    public updateMiniPillCount(count: number): void {
        this._miniPillText.text = String(count);
        this._refreshMiniPillBg();
        this._miniPill.visible = true;
    }

    public resetState(): void {
        this._selectedCount = 0;
        this.iconSprite.tint = ICON_MUTED;
        GameModel.setAutoSpin(false);
        this._highlightSelected();
        this.hidePicker();
        this._miniPill.visible = false;
    }

    private _togglePicker(): void {
        this._isPickerVisible = !this._isPickerVisible;
        this._picker.visible = this._isPickerVisible;
        if (this._isPickerVisible) {
            this._miniPill.visible = false;
            this._addDismissHandler();
        } else {
            this._removeDismissHandler();
            this._refreshMiniPill();
        }
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

    private _refreshMiniPill(): void {
        if (this._selectedCount > 0 && !this._isPickerVisible) {
            this._miniPillText.text = String(this._selectedCount);
            this._refreshMiniPillBg();
            this._miniPill.visible = true;
            this.iconSprite.tint = ACTIVE_COLOR;
        } else {
            this._miniPill.visible = false;
            if (this._selectedCount === 0) {
                this.iconSprite.tint = ICON_MUTED;
                GameModel.setAutoSpin(false);
            }
        }
    }

    private _buildMiniPill(): void {
        this._miniPill = new Container();
        this._miniPill.visible = false;

        this._miniPillBg = new Graphics();
        this._miniPill.addChild(this._miniPillBg);

        this._miniPillText = new Text({
            text: '',
            style: new TextStyle({
                fontFamily: 'Arial',
                fontSize: 22,
                fontWeight: 'bold',
                fill: ACTIVE_COLOR,
            }),
        });
        this._miniPillText.anchor.set(0.5);
        this._miniPill.addChild(this._miniPillText);

        this._miniPill.position.set(0, -48);
        this.addChild(this._miniPill);
    }

    private _refreshMiniPillBg(): void {
        const padX = 10;
        const padY = 4;
        const w = this._miniPillText.width + padX * 2;
        const h = this._miniPillText.height + padY * 2;
        this._miniPillBg.clear();
        this._miniPillBg.roundRect(-w / 2, -h / 2, w, h, h / 2);
        this._miniPillBg.fill({ color: 0x2a3a50 });
    }

    private _buildPicker(): void {
        this._picker = new Container();
        this._picker.visible = false;

        const numberStyle = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 20,
            fontWeight: 'bold',
            fill: MUTED_COLOR,
        });

        const offStyle = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 24,
            fontWeight: 'bold',
            fill: MUTED_COLOR,
        });

        const GAP_X = 10;
        const GAP_Y = 6;
        const PAD_X = 14;
        const PAD_Y = 10;

        const offText = new Text({ text: 'OFF', style: offStyle.clone() });

        const row1Texts: Text[] = [];
        const row2Texts: Text[] = [];
        for (let i = 1; i < PICKER_VALUES.length; i++) {
            const t = new Text({ text: String(PICKER_VALUES[i]), style: numberStyle.clone() });
            if (i <= 3) row1Texts.push(t);
            else row2Texts.push(t);
        }

        const measureRow = (texts: Text[]) => {
            let w = 0;
            for (let i = 0; i < texts.length; i++) {
                w += texts[i].width;
                if (i < texts.length - 1) w += GAP_X;
            }
            return w;
        };

        const row1W = measureRow(row1Texts);
        const row2W = measureRow(row2Texts);
        const offW = offText.width;
        const contentW = Math.max(offW, row1W, row2W);
        const totalW = contentW + PAD_X * 2;

        const rowH = numberStyle.fontSize * 1.4;
        const offRowH = offStyle.fontSize * 1.4;
        const totalH = PAD_Y + offRowH + GAP_Y + rowH + GAP_Y + rowH + PAD_Y;

        this._pickerBg = new Graphics();
        this._pickerBg.roundRect(-totalW / 2, -totalH, totalW, totalH, 12);
        this._pickerBg.fill({ color: 0x1a2233 });
        this._pickerBg.stroke({ color: 0x3a4d66, width: 2 });
        this._picker.addChild(this._pickerBg);

        let curY = -totalH + PAD_Y + offRowH / 2;
        offText.anchor.set(0.5);
        offText.position.set(0, curY);
        this._setupPickerItem(offText, 0);
        this._picker.addChild(offText);
        this._pickerTexts.push(offText);

        curY += offRowH / 2 + GAP_Y + rowH / 2;
        this._placeRow(row1Texts, curY, 1);

        curY += rowH / 2 + GAP_Y + rowH / 2;
        this._placeRow(row2Texts, curY, 4);

        this._pickerBg.eventMode = 'static';
        this._pickerBg.on('pointerdown', (e) => {
            e.stopPropagation();
            this._ignoreDismiss = true;
        });

        this._highlightSelected();
    }

    private _placeRow(texts: Text[], y: number, startIndex: number): void {
        const GAP_X = 10;
        let totalW = 0;
        for (let i = 0; i < texts.length; i++) {
            totalW += texts[i].width;
            if (i < texts.length - 1) totalW += GAP_X;
        }

        let x = -totalW / 2;
        for (let i = 0; i < texts.length; i++) {
            const t = texts[i];
            t.anchor.set(0, 0.5);
            t.position.set(x, y);

            const val = PICKER_VALUES[startIndex + i];
            this._setupPickerItem(t, val);

            this._picker.addChild(t);
            this._pickerTexts.push(t);
            x += t.width + GAP_X;
        }
    }

    private _setupPickerItem(t: Text, val: number): void {
        t.eventMode = 'static';
        t.cursor = 'pointer';

        t.on('pointerdown', (e) => {
            e.stopPropagation();
            this._ignoreDismiss = true;
            this._selectValue(val);
        });

        t.on('pointerover', () => {
            if (val !== this._selectedCount) {
                t.style.fill = HOVER_COLOR;
            }
        });

        t.on('pointerout', () => {
            const isSelected = val === this._selectedCount;
            t.style.fill = isSelected ? ACTIVE_COLOR : MUTED_COLOR;
        });
    }

    private _selectValue(val: number): void {
        this._selectedCount = val;
        this._highlightSelected();
    }

    private _highlightSelected(): void {
        for (let i = 0; i < PICKER_VALUES.length; i++) {
            const isSelected = PICKER_VALUES[i] === this._selectedCount;
            this._pickerTexts[i].style.fill = isSelected ? ACTIVE_COLOR : MUTED_COLOR;
        }
    }
}
