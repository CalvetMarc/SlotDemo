import { Assets, BlurFilter, Container, FederatedPointerEvent, Graphics, Sprite, Spritesheet, Text, TextStyle } from 'pixi.js';
import { TweenManager, type TweenHandle } from '../../Animation/tween';
import { easeOutCubic, easeInCubic } from '../../Animation/easing';
import { GameModel } from '../SlotMachine/game-model';

// ── Constants ────────────────────────────────────────────────────

const BUY_BONUS_TIERS = [
    { tier: 1, title: 'Bonus Feature', multiplier: 88, wildCount: 3 },
    { tier: 2, title: 'Super Bonus Feature', multiplier: 180, wildCount: 4 },
] as const;

const COLORS = {
    panelBg: 0x1a1f2e,
    panelBorder: 0x2a3345,
    cardBg: 0x222840,
    titleText: 0xe8eaf0,
    priceText: 0xffd700,
    buyButton: 0xcc2222,
    buyButtonHover: 0xff3333,
    buyButtonDisabled: 0x555555,
    closeNormal: 0x8892a8,
    closeHover: 0xe8eaf0,
    white: 0xffffff,
} as const;

const FONT_TITLE = 'Poppins, Arial, sans-serif';
const FONT_BODY = 'Inter, Arial, sans-serif';
const ANIM_DURATION = 300;
const BACKDROP_ALPHA = 0.8;
const BLUR_STRENGTH = 4;
const WILD_TEXTURE_ID = 'Wild_01.png';

/** Reference width for portrait sizing (iPhone 7 CSS px). */
const REF_W = 375;

/** Drag-to-close thresholds */
const SWIPE_VELOCITY_THRESHOLD = 0.25; // px/ms
const DRAG_CLOSE_FRACTION = 0.15; // drag 15% of panel size to close

// ── Panel ────────────────────────────────────────────────────────

export class BuyBonusPanelView extends Container {
    private readonly _onBuy: (tier: number) => void;
    private readonly _onClose: () => void;

    private _backdrop!: Graphics;
    private _panelContainer!: Container;
    private _panelBg!: Graphics;
    private _titleText!: Text;
    private _cards: OptionCard[] = [];

    private _isOpen = false;
    private _activeTweens: TweenHandle[] = [];
    private _blurFilter: BlurFilter | null = null;
    private _blurredSiblings: Container[] = [];
    private _blurStrength = BLUR_STRENGTH;

    // Drag-to-close state
    private _isPortrait = false;
    private _openPos = 0;
    private _panelSize = 0;
    private _gutterDragging = false;
    private _gutterDragStart = 0;
    private _gutterDragPanelStart = 0;
    private _gutterPrevPos = 0;
    private _gutterPrevTime = 0;

    constructor(onBuy: (tier: number) => void, onClose: () => void) {
        super();
        this._onBuy = onBuy;
        this._onClose = onClose;
        this.visible = false;
    }

    // ── Public API ───────────────────────────────────────────────

    show(viewportW: number, viewportH: number): void {
        if (this._isOpen) return;
        if (GameModel.isSpinning) return;
        this._isOpen = true;
        this.visible = true;

        this._killActiveTweens();
        this._build(viewportW, viewportH);
        this.updatePrices(GameModel.betAmount);
        this._animateIn(viewportW, viewportH);
    }

    hide(): void {
        if (!this._isOpen) return;
        this._isOpen = false;

        this._killActiveTweens();
        this._animateOut();
    }

    get isOpen(): boolean {
        return this._isOpen;
    }

    resize(viewportW: number, viewportH: number): void {
        if (!this._isOpen) return;
        this._killActiveTweens();
        this._rebuild(viewportW, viewportH);
    }

    updatePrices(betAmount: number): void {
        for (const card of this._cards) {
            const cost = card.multiplier * betAmount;
            const isAffordable = GameModel.balance >= cost;
            card.updatePrice(cost, isAffordable);
        }
    }

    override destroy(options?: boolean | { children?: boolean }): void {
        this._killActiveTweens();
        super.destroy(options);
    }

    // ── Build ────────────────────────────────────────────────────

    private _build(viewportW: number, viewportH: number): void {
        this.removeChildren();
        this._cards = [];

        // Backdrop
        this._backdrop = new Graphics();
        this._backdrop.rect(0, 0, viewportW, viewportH);
        this._backdrop.fill({ color: 0x000000 });
        this._backdrop.alpha = 0;
        this._backdrop.eventMode = 'static';
        this._backdrop.cursor = 'pointer';
        this._backdrop.on('pointertap', () => this._onClose());
        this.addChild(this._backdrop);

        // Panel container
        this._panelContainer = new Container();
        this.addChild(this._panelContainer);

        this._isPortrait = viewportW / viewportH < 1;
        if (this._isPortrait) {
            this._buildPortraitPanel(viewportW, viewportH);
        } else {
            this._buildSidePanel(viewportW, viewportH);
        }
    }

    private _rebuild(viewportW: number, viewportH: number): void {
        this._build(viewportW, viewportH);
        this.updatePrices(GameModel.betAmount);
        this._backdrop.alpha = BACKDROP_ALPHA;
    }

    // ── Side Panel (landscape) ───────────────────────────────────

    private _buildSidePanel(viewportW: number, viewportH: number): void {
        const s = viewportH / 600;

        const gutterW = Math.round(60 * s);
        const contentW = Math.round(420 * s);
        const panelW = gutterW + contentW;

        // Arrow gutter — darker strip on the left (draggable)
        const gutter = new Graphics();
        gutter.rect(0, 0, gutterW, viewportH);
        gutter.fill({ color: COLORS.panelBorder });
        gutter.eventMode = 'static';
        gutter.cursor = 'pointer';
        gutter.on('pointerdown', (e: FederatedPointerEvent) => this._onGutterDown(e));
        gutter.on('globalpointermove', (e: FederatedPointerEvent) => this._onGutterMove(e));
        gutter.on('pointerup', () => this._onGutterUp());
        gutter.on('pointerupoutside', () => this._onGutterUp());
        gutter.on('pointercancel', () => this._onGutterUp());
        this._panelContainer.addChild(gutter);

        // Main panel bg — right of gutter
        this._panelBg = new Graphics();
        this._panelBg.rect(gutterW, 0, contentW, viewportH);
        this._panelBg.fill({ color: COLORS.panelBg });
        this._panelBg.eventMode = 'static';
        this._panelContainer.addChild(this._panelBg);

        this._panelContainer.x = viewportW - panelW;
        this._panelContainer.y = 0;
        this._openPos = this._panelContainer.x;
        this._panelSize = panelW;

        // Title — centered in content area
        const contentCenterX = gutterW + contentW / 2;
        this._titleText = this._createText('BUY BONUS', Math.round(40 * s), COLORS.titleText, 'bold');
        this._titleText.anchor.set(0.5, 0);
        this._titleText.position.set(contentCenterX, Math.round(40 * s));
        this._panelContainer.addChild(this._titleText);

        // Swipe indicator — centered in gutter, vertically centered
        const indicator = this._createSwipeIndicator('right', Math.round(28 * s));
        indicator.position.set(gutterW / 2, viewportH / 2);
        this._panelContainer.addChild(indicator);

        const cardPad = Math.round(30 * s);
        const cardW = contentW - cardPad * 2;
        const cardStartY = Math.round(110 * s);
        const cardGap = Math.round(20 * s);
        const bottomPad = Math.round(20 * s);
        const cardH = Math.round((viewportH - cardStartY - bottomPad - cardGap * (BUY_BONUS_TIERS.length - 1)) / BUY_BONUS_TIERS.length);

        for (let i = 0; i < BUY_BONUS_TIERS.length; i++) {
            const tier = BUY_BONUS_TIERS[i];
            const card = new OptionCard(tier.title, tier.multiplier, tier.wildCount, cardW, cardH, () => this._onBuy(tier.tier));
            card.position.set(gutterW + cardPad, cardStartY + i * (cardH + cardGap));
            this._panelContainer.addChild(card);
            this._cards.push(card);
        }
    }

    // ── Portrait Panel (bottom sheet, width-scaled) ──────────────

    private _buildPortraitPanel(viewportW: number, viewportH: number): void {
        const s = viewportW / REF_W;
        const panelW = viewportW;
        const pad = Math.round(16 * s);
        const cornerR = Math.round(16 * s);

        // Chevron gutter — generous drag area
        const chevronSize = 60;
        const chevronStroke = 8;
        const chevronPadY = Math.round(24 * s);
        const gutterVisualH = chevronPadY + chevronSize + chevronPadY;

        // Equal gap between gutter→title and title→first card
        const titleFs = Math.round(30 * s);
        const titleLineH = Math.round(titleFs * 1.3);
        const sectionGap = Math.round(20 * s);
        const headerH = gutterVisualH + sectionGap + titleLineH + sectionGap;

        const cardGap = Math.round(12 * s);
        const bottomPad = Math.round(16 * s);
        const cardAreaW = panelW - pad * 2;

        // Scale: prefer width-driven, cap by max vertical budget
        const maxPanelH = viewportH * 0.92;
        const maxCardAreaH = maxPanelH - headerH - bottomPad;
        const scaleByW = cardAreaW / REF_CARD_W;
        const scaleByH = (maxCardAreaH - cardGap) / (REF_CARD_H * BUY_BONUS_TIERS.length);
        const cardScale = Math.min(scaleByW, scaleByH);

        const scaledCardH = REF_CARD_H * cardScale;

        // Panel height wraps content tightly
        const panelH = headerH + scaledCardH * BUY_BONUS_TIERS.length
            + cardGap * (BUY_BONUS_TIERS.length - 1) + bottomPad;

        // Panel bg — only top corners rounded
        this._panelBg = new Graphics();
        this._panelBg.moveTo(cornerR, 0);
        this._panelBg.arcTo(panelW, 0, panelW, cornerR, cornerR);
        this._panelBg.lineTo(panelW, panelH);
        this._panelBg.lineTo(0, panelH);
        this._panelBg.lineTo(0, cornerR);
        this._panelBg.arcTo(0, 0, cornerR, 0, cornerR);
        this._panelBg.closePath();
        this._panelBg.fill({ color: COLORS.panelBg });
        this._panelBg.eventMode = 'static';
        this._panelContainer.addChild(this._panelBg);

        // Gutter strip — only top corners rounded (draggable)
        const gutterBg = new Graphics();
        gutterBg.moveTo(cornerR, 0);
        gutterBg.arcTo(panelW, 0, panelW, cornerR, cornerR);
        gutterBg.lineTo(panelW, gutterVisualH);
        gutterBg.lineTo(0, gutterVisualH);
        gutterBg.lineTo(0, cornerR);
        gutterBg.arcTo(0, 0, cornerR, 0, cornerR);
        gutterBg.closePath();
        gutterBg.fill({ color: COLORS.panelBorder });
        gutterBg.eventMode = 'static';
        gutterBg.cursor = 'pointer';
        gutterBg.on('pointerdown', (e: FederatedPointerEvent) => this._onGutterDown(e));
        gutterBg.on('globalpointermove', (e: FederatedPointerEvent) => this._onGutterMove(e));
        gutterBg.on('pointerup', () => this._onGutterUp());
        gutterBg.on('pointerupoutside', () => this._onGutterUp());
        this._panelContainer.addChild(gutterBg);

        this._panelContainer.x = 0;
        this._panelContainer.y = viewportH - panelH;
        this._openPos = this._panelContainer.y;
        this._panelSize = panelH;

        // Swipe indicator — large, thick chevron centered in gutter
        const indicator = this._createSwipeIndicator('down', chevronSize, chevronStroke);
        indicator.position.set(panelW / 2, gutterVisualH / 2);
        this._panelContainer.addChild(indicator);

        // Title — equal spacing from gutter bottom and to first card
        this._titleText = this._createText('BUY BONUS', titleFs, COLORS.titleText, 'bold');
        this._titleText.anchor.set(0.5, 0);
        this._titleText.position.set(panelW / 2, gutterVisualH + sectionGap);
        this._panelContainer.addChild(this._titleText);

        // Cards
        for (let i = 0; i < BUY_BONUS_TIERS.length; i++) {
            const tier = BUY_BONUS_TIERS[i];
            const card = new OptionCard(tier.title, tier.multiplier, tier.wildCount,
                cardAreaW, scaledCardH, () => this._onBuy(tier.tier));
            card.position.set(pad, headerH + i * (scaledCardH + cardGap));
            this._panelContainer.addChild(card);
            this._cards.push(card);
        }
    }

    // ── Animations ───────────────────────────────────────────────

    private _animateIn(viewportW: number, viewportH: number): void {
        const isPortrait = viewportW / viewportH < 1;

        // Scale proportionally to viewport height (ref: Nest Hub 600px) and DPR
        const refH = 600;
        const dpr = window.devicePixelRatio || 1;
        this._blurStrength = BLUR_STRENGTH * (viewportH / refH) * dpr;

        this._applyBlur(0);
        this._activeTweens.push(TweenManager.fadeTo(this._backdrop, BACKDROP_ALPHA, 200));
        this._activeTweens.push(this._tweenBlur(0, this._blurStrength, 200));

        if (isPortrait) {
            const targetY = this._panelContainer.y;
            this._panelContainer.y = viewportH;
            this._activeTweens.push(
                TweenManager.moveTo(this._panelContainer, { x: 0, y: targetY }, ANIM_DURATION, easeOutCubic),
            );
        } else {
            const targetX = this._panelContainer.x;
            this._panelContainer.x = viewportW;
            this._activeTweens.push(
                TweenManager.moveTo(this._panelContainer, { x: targetX, y: 0 }, ANIM_DURATION, easeOutCubic),
            );
        }
    }

    private _animateOut(): void {
        this._activeTweens.push(TweenManager.fadeTo(this._backdrop, 0, 200));
        this._activeTweens.push(this._tweenBlur(this._blurStrength, 0, 200));

        const isSidePanel = this._panelContainer.y === 0;

        if (!isSidePanel) {
            const offY = this._backdrop.height > 0 ? this._backdrop.height : 2000;
            this._activeTweens.push(TweenManager.add({
                duration: ANIM_DURATION,
                context: { p: this._panelContainer, from: this._panelContainer.y, to: offY },
                tweenFn: (t, c) => { c.p.y = c.from + (c.to - c.from) * t; },
                easing: easeInCubic,
                onComplete: () => this._onHideComplete(),
            }));
        } else {
            const offX = this._backdrop.width > 0 ? this._backdrop.width : 2000;
            this._activeTweens.push(TweenManager.add({
                duration: ANIM_DURATION,
                context: { p: this._panelContainer, from: this._panelContainer.x, to: offX },
                tweenFn: (t, c) => { c.p.x = c.from + (c.to - c.from) * t; },
                easing: easeInCubic,
                onComplete: () => this._onHideComplete(),
            }));
        }
    }

    // ── Gutter drag-to-close ─────────────────────────────────────

    private _onGutterDown(e: FederatedPointerEvent): void {
        this._gutterDragging = true;
        const pos = this._isPortrait ? e.globalY : e.globalX;
        this._gutterDragStart = pos;
        this._gutterDragPanelStart = this._isPortrait ? this._panelContainer.y : this._panelContainer.x;
        this._gutterPrevPos = pos;
        this._gutterPrevTime = performance.now();
    }

    private _onGutterMove(e: FederatedPointerEvent): void {
        if (!this._gutterDragging) return;
        const pos = this._isPortrait ? e.globalY : e.globalX;
        const delta = pos - this._gutterDragStart;

        if (this._isPortrait) {
            this._panelContainer.y = Math.max(this._openPos, this._gutterDragPanelStart + delta);
        } else {
            this._panelContainer.x = Math.max(this._openPos, this._gutterDragPanelStart + delta);
        }

        this._gutterPrevPos = pos;
        this._gutterPrevTime = performance.now();
    }

    private _onGutterUp(): void {
        if (!this._gutterDragging) return;
        this._gutterDragging = false;

        const currentPos = this._isPortrait ? this._panelContainer.y : this._panelContainer.x;
        const dragDist = currentPos - this._openPos;
        // Velocity from last move sample (positive = toward close)
        const currentPointer = this._isPortrait
            ? this._panelContainer.y - this._gutterDragPanelStart + this._gutterDragStart
            : this._panelContainer.x - this._gutterDragPanelStart + this._gutterDragStart;
        const pointerDelta = currentPointer - this._gutterPrevPos;
        const dt = performance.now() - this._gutterPrevTime;
        const velocity = dt > 0 && dt < 150 ? pointerDelta / dt : 0;

        const shouldClose = (velocity > SWIPE_VELOCITY_THRESHOLD) || (dragDist > this._panelSize * DRAG_CLOSE_FRACTION);

        if (shouldClose) {
            this.hide();
        } else {
            this._killActiveTweens();
            if (this._isPortrait) {
                this._activeTweens.push(
                    TweenManager.moveTo(this._panelContainer, { x: 0, y: this._openPos }, 200, easeOutCubic),
                );
            } else {
                this._activeTweens.push(
                    TweenManager.moveTo(this._panelContainer, { x: this._openPos, y: 0 }, 200, easeOutCubic),
                );
            }
        }
    }

    private _onHideComplete(): void {
        this.visible = false;
        this.removeChildren();
        this._cards = [];
    }

    // ── Blur ─────────────────────────────────────────────────────

    private _applyBlur(initialStrength: number): void {
        if (!this.parent) return;
        this._blurFilter = new BlurFilter({ strength: initialStrength, quality: 3 });
        this._blurredSiblings = [];
        for (const child of this.parent.children) {
            if (child !== this) {
                child.filters = [...(child.filters ?? []), this._blurFilter];
                this._blurredSiblings.push(child as Container);
            }
        }
    }

    private _removeBlur(): void {
        if (!this._blurFilter) return;
        for (const sibling of this._blurredSiblings) {
            sibling.filters = (sibling.filters ?? []).filter((f) => f !== this._blurFilter);
        }
        this._blurredSiblings = [];
        this._blurFilter = null;
    }

    private _tweenBlur(from: number, to: number, duration: number): TweenHandle {
        return TweenManager.add({
            duration,
            context: { filter: this._blurFilter!, from, to },
            tweenFn: (t, c) => { c.filter.strength = c.from + (c.to - c.from) * t; },
            onComplete: () => { if (to === 0) this._removeBlur(); },
        });
    }

    // ── Helpers ──────────────────────────────────────────────────

    private _killActiveTweens(): void {
        for (const tw of this._activeTweens) tw.kill();
        this._activeTweens.length = 0;
    }

    private _createText(content: string, fontSize: number, fill: number, fontWeight: string = 'normal'): Text {
        return new Text({
            text: content,
            style: new TextStyle({ fontFamily: FONT_TITLE, fontSize, fill, fontWeight: fontWeight as TextStyle['fontWeight'] }),
        });
    }

    private _createSwipeIndicator(direction: 'down' | 'right', size: number, strokeWidth: number = 5): Container {
        const container = new Container();

        // Generous hit area for tapping
        const hitSize = size * 3;
        const hit = new Graphics();
        hit.rect(-hitSize / 2, -hitSize / 2, hitSize, hitSize);
        hit.fill({ color: 0x000000, alpha: 0.001 });
        container.addChild(hit);

        const gfx = new Graphics();

        if (direction === 'down') {
            // Downward chevron ∨ — wide and bold
            const hw = size * 0.7;
            const hh = size * 0.4;
            gfx.moveTo(-hw, -hh);
            gfx.lineTo(0, hh);
            gfx.lineTo(hw, -hh);
        } else {
            // Right-pointing chevron > — tall and bold
            const hw = size * 0.4;
            const hh = size * 0.7;
            gfx.moveTo(-hw, -hh);
            gfx.lineTo(hw, 0);
            gfx.lineTo(-hw, hh);
        }

        gfx.stroke({ color: COLORS.closeNormal, width: strokeWidth });
        container.addChild(gfx);

        container.eventMode = 'static';
        container.cursor = 'pointer';
        container.on('pointerover', () => { gfx.tint = COLORS.closeHover; });
        container.on('pointerout', () => { gfx.tint = 0xffffff; });
        container.on('pointertap', () => this._onClose());

        return container;
    }
}

// ── Wild Sprites helper ──────────────────────────────────────────

function createWildRow(count: number, maxW: number, maxH: number): Container {
    const sheet: Spritesheet | undefined = Assets.get('symbols_static');
    const row = new Container();
    if (!sheet?.textures[WILD_TEXTURE_ID]) return row;

    const sprites: Sprite[] = [];
    for (let i = 0; i < count; i++) {
        const wild = new Sprite(sheet.textures[WILD_TEXTURE_ID]);
        wild.anchor.set(0.5);
        sprites.push(wild);
        row.addChild(wild);
    }

    const nat = sprites[0].texture.width;
    const perSymbol = Math.min(maxW / count, maxH);
    const sc = perSymbol / nat;
    const totalW = count * perSymbol;
    const startX = (maxW - totalW) / 2 + perSymbol / 2;

    for (let i = 0; i < sprites.length; i++) {
        sprites[i].scale.set(sc);
        sprites[i].x = startX + i * perSymbol;
        sprites[i].y = maxH / 2;
    }

    return row;
}

// ── Option Card ──────────────────────────────────────────────────

/**
 * Reference dimensions: built once at fixed size (iPhone 7 proportions),
 * then uniformly scaled to fit the allocated slot.
 */
const REF_CARD_W = 343;
const REF_CARD_H = 212;

class OptionCard extends Container {
    readonly multiplier: number;

    private _buyButton!: Container;
    private _buyBg!: Graphics;
    private _priceText!: Text;
    private _isAffordable = true;

    constructor(
        title: string,
        multiplier: number,
        wildCount: number,
        slotW: number,
        slotH: number,
        onBuy: () => void,
    ) {
        super();
        this.multiplier = multiplier;
        this._buildAtActualSize(title, wildCount, onBuy, slotW, slotH);
    }

    updatePrice(cost: number, isAffordable: boolean): void {
        this._priceText.text = `€${cost.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        this._isAffordable = isAffordable;
        this._refreshButton();
    }

    /** Build content at actual pixel size — no container scaling, so text stays crisp. */
    private _buildAtActualSize(title: string, wildCount: number, onBuy: () => void, w: number, h: number): void {
        const sc = h / REF_CARD_H;
        const cx = w / 2;

        const titleFs = Math.round(24 * sc);
        const priceFs = Math.round(26 * sc);
        const btnH = Math.round(36 * sc);
        const btnW = Math.round(200 * sc);
        const btnFs = Math.round(22 * sc);
        const gap = Math.round(8 * sc);
        const padY = Math.round(10 * sc);
        const cornerR = Math.round(12 * sc);

        const titleLineH = Math.round(titleFs * 1.25);
        const priceLineH = Math.round(priceFs * 1.25);
        const fixedH = padY * 2 + titleLineH + priceLineH + btnH + gap * 3;
        const wildRowH = h - fixedH;

        let y = padY;

        // Card bg
        const bg = new Graphics();
        bg.roundRect(0, 0, w, h, cornerR);
        bg.fill({ color: COLORS.cardBg });
        bg.stroke({ color: COLORS.panelBorder, width: 2 });
        this.addChild(bg);

        // Title
        const titleText = new Text({
            text: title,
            style: new TextStyle({ fontFamily: FONT_TITLE, fontSize: titleFs, fill: COLORS.priceText, fontWeight: 'bold' }),
        });
        titleText.anchor.set(0.5, 0);
        titleText.position.set(cx, y);
        this.addChild(titleText);
        y += titleLineH + gap;

        // Price
        this._priceText = new Text({
            text: '€0.00',
            style: new TextStyle({ fontFamily: FONT_BODY, fontSize: priceFs, fill: COLORS.titleText, fontWeight: 'bold' }),
        });
        this._priceText.anchor.set(0.5, 0);
        this._priceText.position.set(cx, y);
        this.addChild(this._priceText);
        y += priceLineH + gap;

        // Wild row
        const wilds = createWildRow(wildCount, w * 0.9, wildRowH);
        wilds.position.set(cx - w * 0.45, y);
        this.addChild(wilds);
        y += wildRowH + gap;

        // BUY button
        this._buyButton = new Container();

        this._buyBg = new Graphics();
        this._buyBg.roundRect(0, 0, btnW, btnH, btnH / 2);
        this._buyBg.fill({ color: COLORS.buyButton });
        this._buyButton.addChild(this._buyBg);

        const buyLabel = new Text({
            text: 'BUY',
            style: new TextStyle({ fontFamily: FONT_TITLE, fontSize: btnFs, fill: COLORS.white, fontWeight: 'bold', letterSpacing: Math.round(3 * sc) }),
        });
        buyLabel.anchor.set(0.5);
        buyLabel.position.set(btnW / 2, btnH / 2);
        this._buyButton.addChild(buyLabel);

        this._buyButton.position.set(cx - btnW / 2, y);
        this._buyButton.eventMode = 'static';
        this._buyButton.cursor = 'pointer';
        this._buyButton.on('pointerover', () => { if (this._isAffordable) this._buyBg.tint = COLORS.buyButtonHover; });
        this._buyButton.on('pointerout', () => { this._buyBg.tint = 0xffffff; });
        this._buyButton.on('pointertap', () => { if (this._isAffordable) onBuy(); });
        this.addChild(this._buyButton);
    }

    private _refreshButton(): void {
        if (this._isAffordable) {
            this._buyButton.alpha = 1;
            this._buyButton.eventMode = 'static';
            this._buyButton.cursor = 'pointer';
            this._buyBg.tint = 0xffffff;
        } else {
            this._buyButton.alpha = 0.5;
            this._buyButton.eventMode = 'none';
            this._buyButton.cursor = 'default';
            this._buyBg.tint = COLORS.buyButtonDisabled;
        }
    }
}
