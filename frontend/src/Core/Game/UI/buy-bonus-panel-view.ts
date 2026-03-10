import { Assets, BlurFilter, Container, FederatedPointerEvent, Graphics, Sprite, Spritesheet, Text, TextStyle } from 'pixi.js';
import { TweenManager, type TweenHandle } from '../../Animation/tween';
import { easeOutCubic, easeInCubic } from '../../Animation/easing';
import { GameModel } from '../SlotMachine/game-model';
import { AudioManager } from '../../Audio/audio-manager';

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

    // Bet controls
    private _betText!: Text;
    private _betUpBtn!: Container;
    private _betDownBtn!: Container;
    private _unsubBetChanged?: () => void;

    // Scroll state
    private _scrollContent: Container | null = null;
    private _scrollMaskGfx: Graphics | null = null;
    private _scrollEnabled = false;
    private _maxScrollDist = 0;
    private _scrollBaseY = 0;
    private _scrollDragging = false;
    private _scrollDragStartY = 0;
    private _scrollDragContentY = 0;

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
        this._updateBetDisplay();
        this._animateIn(viewportW, viewportH);

        this._unsubBetChanged = GameModel.betChanged.connect(({ amount }) => {
            this._updateBetDisplay();
            this.updatePrices(amount);
        });
    }

    hide(): void {
        if (!this._isOpen) return;
        this._isOpen = false;

        AudioManager.play('negativeClick');
        this._unsubBetChanged?.();
        this._unsubBetChanged = undefined;

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
        this._unsubBetChanged?.();
        this._unsubBetChanged = undefined;
        this._killActiveTweens();
        this._scrollContent = null;
        this._scrollMaskGfx = null;
        super.destroy(options);
    }

    // ── Build ────────────────────────────────────────────────────

    private _build(viewportW: number, viewportH: number): void {
        for (const child of this.children) child.destroy({ children: true });
        this.removeChildren();
        this._cards = [];
        this._scrollContent = null;
        this._scrollMaskGfx = null;
        this._scrollEnabled = false;

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

        // Swipe indicator — centered in gutter, vertically centered
        const indicator = this._createSwipeIndicator('right', Math.round(28 * s));
        indicator.position.set(gutterW / 2, viewportH / 2);
        this._panelContainer.addChild(indicator);

        // Title — fixed, always on panel
        const contentCenterX = gutterW + contentW / 2;
        const titleY = Math.round(40 * s);
        this._titleText = this._createText('BUY BONUS', Math.round(40 * s), COLORS.titleText, 'bold');
        this._titleText.anchor.set(0.5, 0);
        this._titleText.position.set(contentCenterX, titleY);
        this._panelContainer.addChild(this._titleText);

        // Bet controls — fixed, always on panel
        const betControlsY = Math.round(100 * s);
        const betControls = this._buildBetControls(contentW, s);
        betControls.container.position.set(gutterW, betControlsY);
        this._panelContainer.addChild(betControls.container);

        const cardPad = Math.round(30 * s);
        const cardW = contentW - cardPad * 2;
        const cardStartY = betControlsY + betControls.height + Math.round(20 * s);
        const cardGap = Math.round(20 * s);
        const bottomPad = Math.round(20 * s);

        // Card height: maintain minimum aspect ratio
        const minCardH = Math.round(cardW * REF_CARD_H / REF_CARD_W);
        const calcCardH = Math.round((viewportH - cardStartY - bottomPad - cardGap * (BUY_BONUS_TIERS.length - 1)) / BUY_BONUS_TIERS.length);
        const cardH = Math.max(calcCardH, minCardH);

        const totalCardsH = cardH * BUY_BONUS_TIERS.length
            + cardGap * (BUY_BONUS_TIERS.length - 1) + bottomPad;
        const visibleCardsH = viewportH - cardStartY;
        const isOverflow = totalCardsH > visibleCardsH;

        // Cards — scrollable when overflowing
        if (isOverflow) {
            this._scrollContent = new Container();
            this._scrollContent.position.set(gutterW, cardStartY);
            this._panelContainer.addChild(this._scrollContent);

            this._scrollMaskGfx = new Graphics();
            this._scrollMaskGfx.rect(gutterW, cardStartY, contentW, visibleCardsH);
            this._scrollMaskGfx.fill({ color: 0xffffff });
            this._panelContainer.addChild(this._scrollMaskGfx);
            this._scrollContent.mask = this._scrollMaskGfx;

            this._scrollEnabled = true;
            this._scrollBaseY = cardStartY;
            this._maxScrollDist = totalCardsH - visibleCardsH;

            // Transparent hit area for scroll drag
            const hitBg = new Graphics();
            hitBg.rect(0, 0, contentW, totalCardsH);
            hitBg.fill({ color: 0x000000 });
            hitBg.alpha = 0.001;
            this._scrollContent.addChild(hitBg);

            this._setupScrollEvents();

            for (let i = 0; i < BUY_BONUS_TIERS.length; i++) {
                const tier = BUY_BONUS_TIERS[i];
                const card = new OptionCard(tier.title, tier.multiplier, tier.wildCount, cardW, cardH, () => this._onBuy(tier.tier));
                card.position.set(cardPad, i * (cardH + cardGap));
                this._scrollContent.addChild(card);
                this._cards.push(card);
            }
        } else {
            for (let i = 0; i < BUY_BONUS_TIERS.length; i++) {
                const tier = BUY_BONUS_TIERS[i];
                const card = new OptionCard(tier.title, tier.multiplier, tier.wildCount, cardW, cardH, () => this._onBuy(tier.tier));
                card.position.set(gutterW + cardPad, cardStartY + i * (cardH + cardGap));
                this._panelContainer.addChild(card);
                this._cards.push(card);
            }
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
        const betRowH = Math.round(44 * s);
        const headerH = gutterVisualH + sectionGap + titleLineH + sectionGap + betRowH + sectionGap;

        const cardGap = Math.round(12 * s);
        const bottomPad = Math.round(16 * s);
        const cardAreaW = panelW - pad * 2;

        // Scale: always proportional to screen width (no height cap)
        const maxPanelH = viewportH * 0.92;
        const cardScale = cardAreaW / REF_CARD_W;
        const scaledCardH = REF_CARD_H * cardScale;

        // Total content height vs available panel height
        const totalContentH = headerH + scaledCardH * BUY_BONUS_TIERS.length
            + cardGap * (BUY_BONUS_TIERS.length - 1) + bottomPad;
        const isOverflow = totalContentH > maxPanelH;
        const panelH = isOverflow ? maxPanelH : totalContentH;

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

        // Title — fixed, always on panel
        this._titleText = this._createText('BUY BONUS', titleFs, COLORS.titleText, 'bold');
        this._titleText.anchor.set(0.5, 0);
        this._titleText.position.set(panelW / 2, gutterVisualH + sectionGap);
        this._panelContainer.addChild(this._titleText);

        // Bet controls — fixed, always on panel
        const betControls = this._buildBetControls(panelW, s);
        betControls.container.position.set(0, gutterVisualH + sectionGap + titleLineH + sectionGap);
        this._panelContainer.addChild(betControls.container);

        // Cards — scrollable when overflowing
        const totalCardsH = scaledCardH * BUY_BONUS_TIERS.length
            + cardGap * (BUY_BONUS_TIERS.length - 1) + bottomPad;
        const visibleCardsH = panelH - headerH;

        if (isOverflow) {
            this._scrollContent = new Container();
            this._scrollContent.position.set(0, headerH);
            this._panelContainer.addChild(this._scrollContent);

            this._scrollMaskGfx = new Graphics();
            this._scrollMaskGfx.rect(0, headerH, panelW, visibleCardsH);
            this._scrollMaskGfx.fill({ color: 0xffffff });
            this._panelContainer.addChild(this._scrollMaskGfx);
            this._scrollContent.mask = this._scrollMaskGfx;

            this._scrollEnabled = true;
            this._scrollBaseY = headerH;
            this._maxScrollDist = totalCardsH - visibleCardsH;

            // Transparent hit area for scroll drag on empty space
            const hitBg = new Graphics();
            hitBg.rect(0, 0, panelW, totalCardsH);
            hitBg.fill({ color: 0x000000 });
            hitBg.alpha = 0.001;
            this._scrollContent.addChild(hitBg);

            this._setupScrollEvents();

            for (let i = 0; i < BUY_BONUS_TIERS.length; i++) {
                const tier = BUY_BONUS_TIERS[i];
                const card = new OptionCard(tier.title, tier.multiplier, tier.wildCount,
                    cardAreaW, scaledCardH, () => this._onBuy(tier.tier));
                card.position.set(pad, i * (scaledCardH + cardGap));
                this._scrollContent.addChild(card);
                this._cards.push(card);
            }
        } else {
            for (let i = 0; i < BUY_BONUS_TIERS.length; i++) {
                const tier = BUY_BONUS_TIERS[i];
                const card = new OptionCard(tier.title, tier.multiplier, tier.wildCount,
                    cardAreaW, scaledCardH, () => this._onBuy(tier.tier));
                card.position.set(pad, headerH + i * (scaledCardH + cardGap));
                this._panelContainer.addChild(card);
                this._cards.push(card);
            }
        }
    }

    // ── Animations ───────────────────────────────────────────────

    private _animateIn(viewportW: number, viewportH: number): void {
        const isPortrait = viewportW / viewportH < 1;

        const refH = 600;
        this._blurStrength = Math.min(BLUR_STRENGTH * (viewportH / refH), 8);

        const blurQuality = (navigator.maxTouchPoints > 0) ? 2 : 3;
        this._applyBlur(0, blurQuality);
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

        const isTap = dragDist < 5;
        const shouldClose = isTap || (velocity > SWIPE_VELOCITY_THRESHOLD) || (dragDist > this._panelSize * DRAG_CLOSE_FRACTION);

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

    // ── Scroll ──────────────────────────────────────────────────────

    private _setupScrollEvents(): void {
        if (!this._scrollContent) return;

        this._scrollContent.eventMode = 'static';
        this._scrollContent.on('pointerdown', (e: FederatedPointerEvent) => this._onScrollDown(e));
        this._scrollContent.on('globalpointermove', (e: FederatedPointerEvent) => this._onScrollMove(e));
        this._scrollContent.on('pointerup', () => this._onScrollUp());
        this._scrollContent.on('pointerupoutside', () => this._onScrollUp());
        this._scrollContent.on('pointercancel', () => this._onScrollUp());
        this._scrollContent.on('wheel', (e: { deltaY: number }) => this._onScrollWheel(e.deltaY));
    }

    private _onScrollDown(e: FederatedPointerEvent): void {
        this._scrollDragging = true;
        this._scrollDragStartY = e.globalY;
        this._scrollDragContentY = this._scrollContent?.y ?? 0;
    }

    private _onScrollMove(e: FederatedPointerEvent): void {
        if (!this._scrollDragging || !this._scrollContent) return;
        const delta = e.globalY - this._scrollDragStartY;
        this._scrollContent.y = this._scrollDragContentY + delta;
        this._clampScroll();
    }

    private _onScrollUp(): void {
        this._scrollDragging = false;
    }

    private _onScrollWheel(deltaY: number): void {
        if (!this._scrollContent || !this._scrollEnabled) return;
        this._scrollContent.y -= deltaY;
        this._clampScroll();
    }

    private _clampScroll(): void {
        if (!this._scrollContent) return;
        const minY = this._scrollBaseY - this._maxScrollDist;
        const maxY = this._scrollBaseY;
        this._scrollContent.y = Math.max(minY, Math.min(maxY, this._scrollContent.y));
    }

    private _onHideComplete(): void {
        this.visible = false;
        for (const child of this.children) child.destroy({ children: true });
        this.removeChildren();
        this._cards = [];
        this._scrollContent = null;
        this._scrollMaskGfx = null;
        this._scrollEnabled = false;
    }

    // ── Blur ─────────────────────────────────────────────────────

    private _applyBlur(initialStrength: number, quality = 3): void {
        if (!this.parent) return;
        this._blurFilter = new BlurFilter({ strength: initialStrength, quality });
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

    private _updateBetDisplay(): void {
        if (!this._betText) return;
        this._betText.text = `€${GameModel.betAmount.toFixed(2)}`;
        this._refreshBetButtons();
    }

    private _refreshBetButtons(): void {
        if (!this._betUpBtn || !this._betDownBtn) return;
        const isUp = GameModel.isMaxBet;
        const isDown = GameModel.isMinBet;
        this._betUpBtn.alpha = isUp ? 0.3 : 1;
        this._betUpBtn.eventMode = isUp ? 'none' : 'static';
        this._betDownBtn.alpha = isDown ? 0.3 : 1;
        this._betDownBtn.eventMode = isDown ? 'none' : 'static';
    }

    /**
     * Builds the bet row: [▼] €X.XX [▲] and returns the container + its height.
     */
    private _buildBetControls(rowW: number, scale: number): { container: Container; height: number } {
        const row = new Container();
        const fontSize = Math.round(20 * scale);
        const labelFs = Math.round(16 * scale);
        const rowH = Math.round(44 * scale);
        const pillH = Math.round(38 * scale);
        const pillPadX = Math.round(16 * scale);
        const arrowPad = Math.round(12 * scale);
        const cx = rowW / 2;

        // Measure texts to size pill dynamically
        const betLabel = new Text({
            text: 'Bet',
            style: new TextStyle({ fontFamily: FONT_BODY, fontSize: labelFs, fill: COLORS.closeNormal, fontWeight: 'bold' }),
        });
        betLabel.anchor.set(0, 0.5);

        this._betText = new Text({
            text: `€${GameModel.betAmount.toFixed(2)}`,
            style: new TextStyle({ fontFamily: FONT_BODY, fontSize, fill: COLORS.closeNormal, fontWeight: 'bold' }),
        });
        this._betText.anchor.set(0, 0.5);

        const arrowW = Math.round(8 * scale);
        const gap = Math.round(8 * scale);
        const innerW = arrowW + arrowPad + betLabel.width + gap + this._betText.width + arrowPad + arrowW;
        const pillW = innerW + pillPadX * 2;
        const pillX = cx - pillW / 2;
        const pillY = (rowH - pillH) / 2;

        // Pill background
        const pill = new Graphics();
        pill.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
        pill.fill({ color: COLORS.panelBorder });
        row.addChild(pill);

        // Position elements inside pill
        let x = pillX + pillPadX;

        // Left arrow (decrease)
        this._betDownBtn = this._createBetArrow('left', arrowW, scale);
        this._betDownBtn.position.set(x + arrowW / 2, rowH / 2);
        this._betDownBtn.on('pointertap', () => { AudioManager.play('negativeClick'); GameModel.decreaseBet(); });
        row.addChild(this._betDownBtn);
        x += arrowW + arrowPad;

        // "Bet" label
        betLabel.position.set(x, rowH / 2);
        row.addChild(betLabel);
        x += betLabel.width + gap;

        // Bet amount
        this._betText.position.set(x, rowH / 2);
        row.addChild(this._betText);
        x += this._betText.width + arrowPad;

        // Right arrow (increase)
        this._betUpBtn = this._createBetArrow('right', arrowW, scale);
        this._betUpBtn.position.set(x + arrowW / 2, rowH / 2);
        this._betUpBtn.on('pointertap', () => { AudioManager.play('positiveClick'); GameModel.increaseBet(); });
        row.addChild(this._betUpBtn);

        this._refreshBetButtons();
        return { container: row, height: rowH };
    }

    private _createBetArrow(direction: 'left' | 'right', _size: number, scale: number): Container {
        const btn = new Container();
        btn.eventMode = 'static';
        btn.cursor = 'pointer';

        const tri = new Graphics();
        const hh = Math.round(8 * scale);
        const hw = Math.round(6 * scale);
        if (direction === 'right') {
            tri.moveTo(-hw, -hh);
            tri.lineTo(hw, 0);
            tri.lineTo(-hw, hh);
            tri.closePath();
        } else {
            tri.moveTo(hw, -hh);
            tri.lineTo(-hw, 0);
            tri.lineTo(hw, hh);
            tri.closePath();
        }
        tri.fill({ color: COLORS.titleText });
        btn.addChild(tri);

        // Generous hit area
        const hitPad = Math.round(16 * scale);
        const hitGfx = new Graphics();
        hitGfx.rect(-hw - hitPad, -hh - hitPad, (hw + hitPad) * 2, (hh + hitPad) * 2);
        hitGfx.fill({ color: 0x000000 });
        hitGfx.alpha = 0;
        btn.addChild(hitGfx);

        btn.on('pointerover', () => { tri.tint = COLORS.titleText; });
        btn.on('pointerout', () => { tri.tint = 0xffffff; });

        return btn;
    }

    private _createSwipeIndicator(direction: 'down' | 'right', size: number, strokeWidth: number = 5): Container {
        const container = new Container();
        container.eventMode = 'none';

        const gfx = new Graphics();

        if (direction === 'down') {
            const hw = size * 0.7;
            const hh = size * 0.4;
            gfx.moveTo(-hw, -hh);
            gfx.lineTo(0, hh);
            gfx.lineTo(hw, -hh);
        } else {
            const hw = size * 0.4;
            const hh = size * 0.7;
            gfx.moveTo(-hw, -hh);
            gfx.lineTo(hw, 0);
            gfx.lineTo(-hw, hh);
        }

        gfx.stroke({ color: COLORS.closeNormal, width: strokeWidth });
        container.addChild(gfx);

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
        const priceFs = Math.round(20 * sc);
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

        // Wild row
        const wilds = createWildRow(wildCount, w * 0.9, wildRowH);
        wilds.position.set(cx - w * 0.45, y);
        this.addChild(wilds);
        y += wildRowH + Math.round(0 * sc);

        // Price
        this._priceText = new Text({
            text: '€0.00',
            style: new TextStyle({ fontFamily: FONT_BODY, fontSize: priceFs, fill: COLORS.titleText, fontWeight: 'bold' }),
        });
        this._priceText.anchor.set(0.5, 0);
        this._priceText.position.set(cx, y);
        this.addChild(this._priceText);
        y += priceLineH + Math.round(16 * sc);

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
        this._buyButton.on('pointertap', () => { if (this._isAffordable) { AudioManager.play('buyBonus'); onBuy(); } });
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
