import { Assets, BlurFilter, Container, Graphics, Sprite, Spritesheet, Text, TextStyle, FederatedPointerEvent, Texture } from 'pixi.js';
import { TweenManager, type TweenHandle } from '../../Animation/tween';
import { easeOutCubic, easeInCubic } from '../../Animation/easing';
import { GameModel } from '../SlotMachine/game-model';

// ── Constants ────────────────────────────────────────────────────

const COLORS = {
    panelBg: 0x1a1f2e,
    panelBorder: 0x2a3345,
    titleText: 0xe8eaf0,
    gold: 0xffd700,
    tabActive: 0xe8eaf0,
    tabInactive: 0x6b7280,
    tabUnderline: 0xe8eaf0,
    bodyText: 0xc8cdd8,
    closeNormal: 0x8892a8,
    closeHover: 0xe8eaf0,
} as const;

const FONT_TITLE = 'Poppins, Arial, sans-serif';
const FONT_BODY = 'Inter, Arial, sans-serif';
const ANIM_DURATION = 300;
const BACKDROP_ALPHA = 0.8;
const BLUR_STRENGTH = 4;

const TAB_NAMES = ['PAYS', 'INFO', 'EXTRA'] as const;

/** Reference width for portrait sizing. */
const REF_W = 375;

/** Drag-to-close thresholds */
const SWIPE_VELOCITY_THRESHOLD = 0.25; // px/ms
const DRAG_CLOSE_FRACTION = 0.15; // drag 15% of panel size to close

// ── Paytable data ────────────────────────────────────────────────

/** Paytable frames ordered by descending payout (Wild first). */
const PAYTABLE_FRAMES = [
    'Wild_pay.png',
    '1_pay.png',
    '2_pay.png',
    '3_pay.png',
    'A_pay.png',
    'K_pay.png',
    'Q_pay.png',
    'J_pay.png',
];

const WILD_BONUS_PAYS = [
    { count: 3, multiplier: 8 },
    { count: 4, multiplier: 21 },
    { count: 5, multiplier: 83 },
];

// ── Panel ────────────────────────────────────────────────────────

export class InfoPanelView extends Container {
    private readonly _onClose: () => void;

    private _backdrop!: Graphics;
    private _panelContainer!: Container;
    private _panelBg!: Graphics;
    private _titleText!: Text;

    private _tabBar!: Container;
    private _tabTexts: Text[] = [];
    private _tabUnderlines: Graphics[] = [];
    private _activeTab = 0;

    private _scrollArea!: Container;
    private _scrollMask!: Graphics;
    private _scrollContent!: Container;
    private _scrollY = 0;
    private _maxScrollY = 0;
    private _isDragging = false;
    private _dragStartY = 0;
    private _dragStartScrollY = 0;

    private _contentViewportW = 0;
    private _contentViewportH = 0;
    private _contentOffsetX = 0;
    private _scaleFactor = 1;

    private _isOpen = false;
    private _activeTweens: TweenHandle[] = [];
    private _blurFilter: BlurFilter | null = null;
    private _blurredSiblings: Container[] = [];
    private _blurStrength = BLUR_STRENGTH;

    private _viewportW = 0;
    private _viewportH = 0;

    // Drag-to-close state
    private _isPortrait = false;
    private _openPos = 0;
    private _panelSize = 0;
    private _gutterDragging = false;
    private _gutterDragStart = 0;
    private _gutterDragPanelStart = 0;
    private _gutterPrevPos = 0;
    private _gutterPrevTime = 0;

    constructor(onClose: () => void) {
        super();
        this._onClose = onClose;
        this.visible = false;
    }

    // ── Public API ───────────────────────────────────────────────

    async show(viewportW: number, viewportH: number): Promise<void> {
        if (this._isOpen) return;
        if (GameModel.isSpinning) return;
        this._isOpen = true;
        this.visible = true;

        await Assets.loadBundle('info');

        this._killActiveTweens();
        this._build(viewportW, viewportH);
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

    override destroy(options?: boolean | { children?: boolean }): void {
        this._killActiveTweens();
        super.destroy(options);
    }

    // ── Build ────────────────────────────────────────────────────

    private _build(viewportW: number, viewportH: number): void {
        this.removeChildren();
        this._tabTexts = [];
        this._tabUnderlines = [];
        this._viewportW = viewportW;
        this._viewportH = viewportH;

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
        this._backdrop.alpha = BACKDROP_ALPHA;
    }

    // ── Side Panel (landscape) ───────────────────────────────────

    private _buildSidePanel(viewportW: number, viewportH: number): void {
        const s = viewportH / 600;
        this._scaleFactor = s;

        const gutterW = Math.round(60 * s);
        const contentW = Math.round(420 * s);
        const panelW = gutterW + contentW;

        // Arrow gutter (draggable)
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

        // Main panel bg — blocks clicks from reaching the backdrop
        this._panelBg = new Graphics();
        this._panelBg.rect(gutterW, 0, contentW, viewportH);
        this._panelBg.fill({ color: COLORS.panelBg });
        this._panelBg.eventMode = 'static';
        this._panelContainer.addChild(this._panelBg);

        this._panelContainer.x = viewportW - panelW;
        this._panelContainer.y = 0;
        this._openPos = this._panelContainer.x;
        this._panelSize = panelW;

        // Title
        const contentCenterX = gutterW + contentW / 2;
        const titleFs = Math.round(40 * s);
        this._titleText = this._createText('GAME MENU', titleFs, COLORS.titleText, 'bold');
        this._titleText.anchor.set(0.5, 0);
        this._titleText.position.set(contentCenterX, Math.round(30 * s));
        this._panelContainer.addChild(this._titleText);

        // Swipe indicator
        const indicator = this._createSwipeIndicator('right', Math.round(28 * s));
        indicator.position.set(gutterW / 2, viewportH / 2);
        this._panelContainer.addChild(indicator);

        // Tab bar
        const tabY = Math.round(88 * s);
        this._buildTabBar(gutterW, contentW, tabY, s);

        // Scroll area
        const scrollTop = tabY + Math.round(65 * s);
        const scrollH = viewportH - scrollTop - Math.round(10 * s);
        const pad = Math.round(20 * s);
        this._contentViewportW = contentW - pad * 2;
        this._contentViewportH = scrollH;
        this._contentOffsetX = gutterW + pad;
        this._buildScrollArea(this._contentOffsetX, scrollTop, this._contentViewportW, scrollH);

        // Build initial tab content
        this._buildTabContent();
    }

    // ── Portrait Panel (bottom sheet) ────────────────────────────

    private _buildPortraitPanel(viewportW: number, viewportH: number): void {
        const s = viewportW / REF_W;
        this._scaleFactor = s;
        const panelW = viewportW;
        const cornerR = Math.round(16 * s);

        // Chevron gutter — generous drag area
        const chevronSize = 60;
        const chevronStroke = 8;
        const chevronPadY = Math.round(24 * s);
        const gutterVisualH = chevronPadY + chevronSize + chevronPadY;

        const titleFs = Math.round(30 * s);
        const titleLineH = Math.round(titleFs * 1.3);
        const sectionGap = Math.round(16 * s);

        const tabBarH = Math.round(40 * s);
        const tabBottomGap = Math.round(28 * s);
        const headerH = gutterVisualH + sectionGap + titleLineH + sectionGap + tabBarH + tabBottomGap;

        const panelH = viewportH * 0.85;
        const scrollH = panelH - headerH - Math.round(10 * s);

        // Panel bg — top corners rounded
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

        // Gutter strip (draggable)
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

        // Swipe indicator
        const indicator = this._createSwipeIndicator('down', chevronSize, chevronStroke);
        indicator.position.set(panelW / 2, gutterVisualH / 2);
        this._panelContainer.addChild(indicator);

        // Title
        this._titleText = this._createText('GAME MENU', titleFs, COLORS.titleText, 'bold');
        this._titleText.anchor.set(0.5, 0);
        this._titleText.position.set(panelW / 2, gutterVisualH + sectionGap);
        this._panelContainer.addChild(this._titleText);

        // Tab bar
        const titleToTabGap = Math.round(22 * s);
        const tabY = gutterVisualH + sectionGap + titleLineH + titleToTabGap;
        this._buildTabBar(0, panelW, tabY, s);

        // Scroll area
        const pad = Math.round(16 * s);
        this._contentViewportW = panelW - pad * 2;
        this._contentViewportH = scrollH;
        this._contentOffsetX = pad;
        this._buildScrollArea(pad, headerH, this._contentViewportW, scrollH);

        // Build initial tab content
        this._buildTabContent();
    }

    // ── Tab bar ──────────────────────────────────────────────────

    private _buildTabBar(offsetX: number, containerW: number, y: number, s: number): void {
        this._tabBar = new Container();
        this._tabBar.position.set(offsetX, y);
        this._panelContainer.addChild(this._tabBar);

        const tabFs = Math.round(20 * s);
        const tabW = containerW / TAB_NAMES.length;

        for (let i = 0; i < TAB_NAMES.length; i++) {
            const tab = this._createText(TAB_NAMES[i], tabFs, i === this._activeTab ? COLORS.tabActive : COLORS.tabInactive, 'bold');
            tab.anchor.set(0.5, 0);
            tab.position.set(tabW * i + tabW / 2, 0);
            tab.eventMode = 'static';
            tab.cursor = 'pointer';
            tab.on('pointertap', () => this._switchTab(i));
            this._tabBar.addChild(tab);
            this._tabTexts.push(tab);

            // Underline
            const underline = new Graphics();
            const lineW = Math.round(60 * s);
            underline.rect(-lineW / 2, 0, lineW, Math.round(3 * s));
            underline.fill({ color: COLORS.tabUnderline });
            underline.position.set(tabW * i + tabW / 2, Math.round(28 * s));
            underline.visible = i === this._activeTab;
            this._tabBar.addChild(underline);
            this._tabUnderlines.push(underline);
        }
    }

    private _switchTab(index: number): void {
        if (index === this._activeTab) return;
        this._activeTab = index;

        // Update tab visuals
        for (let i = 0; i < TAB_NAMES.length; i++) {
            this._tabTexts[i].style.fill = i === index ? COLORS.tabActive : COLORS.tabInactive;
            this._tabUnderlines[i].visible = i === index;
        }

        // Rebuild content
        this._scrollY = 0;
        this._buildTabContent();
    }

    // ── Scroll area ──────────────────────────────────────────────

    private _buildScrollArea(x: number, y: number, w: number, h: number): void {
        this._scrollArea = new Container();
        this._scrollArea.position.set(x, y);
        this._panelContainer.addChild(this._scrollArea);

        // Hit area for interaction
        const hitArea = new Graphics();
        hitArea.rect(0, 0, w, h);
        hitArea.fill({ color: 0x000000, alpha: 0.001 });
        this._scrollArea.addChild(hitArea);

        // Mask
        this._scrollMask = new Graphics();
        this._scrollMask.rect(0, 0, w, h);
        this._scrollMask.fill({ color: 0xffffff });
        this._scrollArea.addChild(this._scrollMask);

        // Scroll content
        this._scrollContent = new Container();
        this._scrollContent.mask = this._scrollMask;
        this._scrollArea.addChild(this._scrollContent);

        // Interaction
        this._scrollArea.eventMode = 'static';
        this._scrollArea.on('pointerdown', (e: FederatedPointerEvent) => this._onDragStart(e));
        this._scrollArea.on('pointermove', (e: FederatedPointerEvent) => this._onDragMove(e));
        this._scrollArea.on('pointerup', () => this._onDragEnd());
        this._scrollArea.on('pointerupoutside', () => this._onDragEnd());
        this._scrollArea.on('wheel', (e: WheelEvent) => this._onWheel(e));
    }

    private _onDragStart(e: FederatedPointerEvent): void {
        this._isDragging = true;
        this._dragStartY = e.globalY;
        this._dragStartScrollY = this._scrollY;
    }

    private _onDragMove(e: FederatedPointerEvent): void {
        if (!this._isDragging) return;
        const delta = e.globalY - this._dragStartY;
        this._scrollY = this._dragStartScrollY + delta;
        this._clampScroll();
        this._scrollContent.y = this._scrollY;
    }

    private _onDragEnd(): void {
        this._isDragging = false;
    }

    private _onWheel(e: WheelEvent): void {
        this._scrollY -= e.deltaY;
        this._clampScroll();
        this._scrollContent.y = this._scrollY;
    }

    private _clampScroll(): void {
        this._scrollY = Math.max(-this._maxScrollY, Math.min(0, this._scrollY));
    }

    // ── Tab content builders ─────────────────────────────────────

    private _buildTabContent(): void {
        this._scrollContent.removeChildren();
        this._scrollY = 0;
        this._scrollContent.y = 0;

        switch (this._activeTab) {
            case 0: this._buildPaytableContent(); break;
            case 1: this._buildInfoContent(); break;
            case 2: this._buildRulesContent(); break;
        }
    }

    private _buildPaytableContent(): void {
        const w = this._contentViewportW;
        const s = this._scaleFactor;
        const pad = Math.round(10 * s);
        const colGap = Math.round(10 * s);
        const rowGap = Math.round(10 * s);

        const sheet: Spritesheet | undefined = Assets.get('paytable');

        // Section title
        const sectionTitle = this._createText('Symbols', Math.round(18 * s), COLORS.gold, 'bold');
        sectionTitle.position.set(0, 0);
        this._scrollContent.addChild(sectionTitle);
        const titleBottomY = Math.round(30 * s);

        // ── Compute uniform cell size (4 columns) ─────────────────
        const cols = 4;
        const innerW = w - pad * 2;
        const colW = (innerW - colGap * (cols - 1)) / cols;

        // Find the widest frame to use as uniform scale reference
        let maxNatW = 401; // fallback (1_pay.png)
        const natH = 248;  // all frames share the same height
        for (const frame of PAYTABLE_FRAMES) {
            const tex = sheet?.textures[frame];
            if (tex && tex.width > maxNatW) maxNatW = tex.width;
        }
        const uniformScale = colW / maxNatW;
        const cellH = Math.round(natH * uniformScale);

        const rows = Math.ceil(PAYTABLE_FRAMES.length / cols);
        const gridH = rows * cellH + (rows - 1) * rowGap;
        const totalBgH = pad + gridH + pad;

        // ── Shared background for all symbols ────────────────────
        const bg = new Graphics();
        bg.roundRect(0, titleBottomY, w, totalBgH, Math.round(8 * s));
        bg.fill({ color: 0x222840 });
        this._scrollContent.addChild(bg);

        // ── Place sprites in 4-column grid (centered in each cell) ─
        for (let i = 0; i < PAYTABLE_FRAMES.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cellX = pad + col * (colW + colGap);
            const cellY = titleBottomY + pad + row * (cellH + rowGap);
            const frame = PAYTABLE_FRAMES[i];

            if (sheet?.textures[frame]) {
                const sprite = new Sprite(sheet.textures[frame]);
                sprite.anchor.set(0.5);
                sprite.scale.set(uniformScale);
                sprite.position.set(cellX + colW / 2, cellY + cellH / 2);
                this._scrollContent.addChild(sprite);
            }
        }

        let y = titleBottomY + totalBgH + Math.round(12 * s);
        const fs = Math.round(14 * s);

        // ── Wild substitution note ───────────────────────────────
        const wildNote = this._createBodyText('Wild substitutes for all symbols and pays in any position.', fs);
        wildNote.style.wordWrap = true;
        wildNote.style.wordWrapWidth = w;
        wildNote.position.set(0, y);
        this._scrollContent.addChild(wildNote);
        y += wildNote.getBounds().height + Math.round(20 * s);

        // ── Line patterns section ────────────────────────────────
        const linesTitle = this._createText('Line Patterns', Math.round(18 * s), COLORS.gold, 'bold');
        linesTitle.position.set(0, y);
        this._scrollContent.addChild(linesTitle);
        y += Math.round(30 * s);

        const linesTex: Texture | undefined = Assets.get('pattern_lines');
        if (linesTex) {
            const linesPad = Math.round(10 * s);
            const linesSprite = new Sprite(linesTex);
            const scaleToFit = (w - linesPad * 2) / linesSprite.texture.width;
            linesSprite.scale.set(scaleToFit);
            const imgH = linesSprite.texture.height * scaleToFit;
            const linesBgH = imgH + linesPad * 2;

            const linesBg = new Graphics();
            linesBg.roundRect(0, y, w, linesBgH, Math.round(8 * s));
            linesBg.fill({ color: 0x222840 });
            this._scrollContent.addChild(linesBg);

            linesSprite.position.set(linesPad, y + linesPad);
            this._scrollContent.addChild(linesSprite);
            y += linesBgH + Math.round(12 * s);
        }

        const linesNote = this._createBodyText('Wins are evaluated from left to right. 3 or more consecutive matching symbols on a payline, starting from the leftmost reel, result in a win. A payline made entirely of Wild symbols will not count as a separate line win.', fs);
        linesNote.style.wordWrap = true;
        linesNote.style.wordWrapWidth = w;
        linesNote.position.set(0, y);
        this._scrollContent.addChild(linesNote);
        y += linesNote.getBounds().height + Math.round(20 * s);

        // ── Bonus feature section ────────────────────────────────
        const bonusTitle = this._createText('Bonus Feature', Math.round(18 * s), COLORS.gold, 'bold');
        bonusTitle.position.set(0, y);
        this._scrollContent.addChild(bonusTitle);
        y += Math.round(28 * s);

        const bonusIntro = this._createBodyText('3 or more Wild symbols trigger the Bonus Game. Pick chests to reveal multipliers applied to the triggering spin win.', fs);
        bonusIntro.style.wordWrap = true;
        bonusIntro.style.wordWrapWidth = w;
        bonusIntro.position.set(0, y);
        this._scrollContent.addChild(bonusIntro);
        y += bonusIntro.getBounds().height + Math.round(14 * s);

        const tiers = [
            '3 Wilds — x25, x75, x125 + 2 skulls',
            '4 Wilds — x30, x60, x90, x120 + 1 skull',
            '5 Wilds — x20, x40, x60, x80, x100',
        ];
        for (const tier of tiers) {
            const line = this._createBodyText(tier, fs);
            line.position.set(0, y);
            this._scrollContent.addChild(line);
            y += Math.round(22 * s);
        }

        y += Math.round(6 * s);
        const skullNote = this._createBodyText('Revealing a skull ends the Bonus Game.', fs);
        skullNote.style.wordWrap = true;
        skullNote.style.wordWrapWidth = w;
        skullNote.position.set(0, y);
        this._scrollContent.addChild(skullNote);
        y += Math.round(36 * s);

        this._maxScrollY = Math.max(0, y - this._contentViewportH);
    }

    private _buildRulesContent(): void {
        const w = this._contentViewportW;
        const s = this._scaleFactor;
        let y = 0;
        const sectionGap = Math.round(20 * s);
        const fs = Math.round(14 * s);
        const titleFs = Math.round(16 * s);

        // ── Malfunction ───────────────────────────────────────────
        const malfTitle = this._createText('MALFUNCTION', titleFs, COLORS.gold, 'bold');
        malfTitle.position.set(0, y);
        this._scrollContent.addChild(malfTitle);
        y += Math.round(24 * s);

        const malfBody = this._createBodyText('Malfunction voids all pays and plays.', fs);
        malfBody.style.wordWrap = true;
        malfBody.style.wordWrapWidth = w;
        malfBody.position.set(0, y);
        this._scrollContent.addChild(malfBody);
        y += malfBody.getBounds().height + sectionGap;

        // ── RTP (Return to Player) ────────────────────────────────
        const rtpTitle = this._createText('RETURN TO PLAYER', titleFs, COLORS.gold, 'bold');
        rtpTitle.position.set(0, y);
        this._scrollContent.addChild(rtpTitle);
        y += Math.round(24 * s);

        const rtpIntro = this._createBodyText('The theoretical return to player (RTP) is the statistical expected percentage of total money wagered that is paid back to players over time.', fs);
        rtpIntro.style.wordWrap = true;
        rtpIntro.style.wordWrapWidth = w;
        rtpIntro.position.set(0, y);
        this._scrollContent.addChild(rtpIntro);
        y += rtpIntro.getBounds().height + Math.round(14 * s);

        const rtpLines = [
            'Overall game RTP: 96.14%',
            '',
            'Base game (lines): 33.71%',
            'Wild Pay: 6.21%',
            'Bonus (chests): 56.22%',
            '',
            'Buy Bonus Tier 1 (3 Wilds): 94.32%',
            'Buy Bonus Tier 2 (4 Wilds): 95.00%',
        ];
        for (const line of rtpLines) {
            if (line === '') {
                y += Math.round(8 * s);
                continue;
            }
            const rtpLine = this._createBodyText(line, fs);
            rtpLine.position.set(0, y);
            this._scrollContent.addChild(rtpLine);
            y += Math.round(22 * s);
        }

        y += Math.round(16 * s);

        this._maxScrollY = Math.max(0, y - this._contentViewportH);
    }

    private _buildInfoContent(): void {
        const w = this._contentViewportW;
        const s = this._scaleFactor;
        let y = 0;
        const sectionGap = Math.round(20 * s);
        const fs = Math.round(14 * s);
        const titleFs = Math.round(16 * s);

        const sheet: Spritesheet | undefined = Assets.get('ui_icons');

        const entries: { title: string; text: string; iconFrame?: string }[] = [
            { title: 'HOW TO PLAY', text: 'To select a bet, press the up/down arrows and choose from the available bets. To start a game round, press the Spin button. Alternatively, press the keyboard space bar.' },
            { title: 'AUTOPLAY', text: 'To play a number of game rounds in succession, press the Auto button and select the number of rounds to play. Then press the Spin button to start. The Spin button displays the remaining Autoplays and, when pressed, cancels them.', iconFrame: 'auto.png' },
            { title: 'TURBO MODE', text: 'Turbo Mode may be enabled or disabled by pressing the Turbo button. When enabled, certain animations during a game round are skipped or played through quickly.', iconFrame: 'turboOff.png' },
            { title: 'PAYOUTS', text: 'A symbol win is awarded when a number of instances of the same symbol appear on adjacent reels, starting from the leftmost reel. Only the payout for the longest winning combination is awarded. The highest combination win value is always awarded. All wins occur on matching win combinations. Wins on separate matching combinations are added. The paytable reflects the current bet configuration, based on the bet per matching combination.' },
        ];

        for (const entry of entries) {
            const title = this._createText(entry.title, titleFs, COLORS.gold, 'bold');
            title.position.set(0, y);
            this._scrollContent.addChild(title);

            if (entry.iconFrame && sheet?.textures[entry.iconFrame]) {
                const icon = new Sprite(sheet.textures[entry.iconFrame]);
                const iconSize = Math.round(titleFs * 1.4);
                icon.width = iconSize;
                icon.height = iconSize;
                icon.anchor.set(0, 0.15);
                icon.position.set(title.width + Math.round(8 * s), y);
                this._scrollContent.addChild(icon);
            }

            y += Math.round(24 * s);

            const body = this._createBodyText(entry.text, fs);
            body.style.wordWrap = true;
            body.style.wordWrapWidth = w;
            body.position.set(0, y);
            this._scrollContent.addChild(body);

            y += body.getBounds().height + sectionGap;
        }

        this._maxScrollY = Math.max(0, y - this._contentViewportH);
    }

    // ── Animations ───────────────────────────────────────────────

    private _animateIn(viewportW: number, viewportH: number): void {
        const isPortrait = viewportW / viewportH < 1;

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
        this._tabTexts = [];
        this._tabUnderlines = [];
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

    private _createBodyText(content: string, fontSize: number): Text {
        return new Text({
            text: content,
            style: new TextStyle({ fontFamily: FONT_BODY, fontSize, fill: COLORS.bodyText }),
        });
    }

    private _createSwipeIndicator(direction: 'down' | 'right', size: number, strokeWidth: number = 5): Container {
        const container = new Container();

        const hitSize = size * 3;
        const hit = new Graphics();
        hit.rect(-hitSize / 2, -hitSize / 2, hitSize, hitSize);
        hit.fill({ color: 0x000000, alpha: 0.001 });
        container.addChild(hit);

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

        container.eventMode = 'static';
        container.cursor = 'pointer';
        container.on('pointerover', () => { gfx.tint = COLORS.closeHover; });
        container.on('pointerout', () => { gfx.tint = 0xffffff; });
        container.on('pointertap', () => this._onClose());

        return container;
    }
}
