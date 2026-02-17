import { Container, Graphics, FederatedPointerEvent, Rectangle } from 'pixi.js';
import { SingletonBase } from '../Abstractions/singleton-base';

interface Guide {
    type: 'horizontal' | 'vertical';
    position: number;
    graphic: Graphics;
    hitArea: Graphics;
}

export class GuideManager extends SingletonBase {
    private _container: Container;
    private _guides: Guide[] = [];
    private _isGKeyDown: boolean = false;
    private _guideColor: number = 0x00ff00;
    private _guideAlpha: number = 0.8;
    private _guideThickness: number = 2;
    private _hitAreaThickness: number = 30; // Larger hit area for easier grabbing on mobile
    private _viewportWidth: number = 800;
    private _viewportHeight: number = 600;

    protected constructor() {
        super();
        this._container = new Container();
        this._container.zIndex = 9999; // Always on top
        this._container.sortableChildren = true;
        this.setupKeyboardListeners();
    }

    public static get I(): GuideManager {
        return super.getInstance<GuideManager>();
    }

    get root(): Container {
        return this._container;
    }

    setViewportSize(width: number, height: number): void {
        this._viewportWidth = width;
        this._viewportHeight = height;
        // Update all guides to span the full viewport
        this._guides.forEach(guide => this.updateGuideSize(guide));
    }

    private _onKeyDown = (e: KeyboardEvent): void => {
        if (e.key === 'g' || e.key === 'G') {
            this._isGKeyDown = true;
        }

        if (this._isGKeyDown) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.addHorizontalGuide(0);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.addVerticalGuide(0);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.addHorizontalGuide(this._viewportHeight / 2);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.addVerticalGuide(this._viewportWidth / 2);
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                this.removeLastGuide();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.removeAllGuides();
            }
        }
    };

    private _onKeyUp = (e: KeyboardEvent): void => {
        if (e.key === 'g' || e.key === 'G') {
            this._isGKeyDown = false;
        }
    };

    private setupKeyboardListeners(): void {
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    dispose(): void {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        this.removeAllGuides();
    }

    // Public method to add guides programmatically (useful for mobile)
    public addHorizontalGuideAt(y: number): void {
        this.addHorizontalGuide(y);
    }

    public addVerticalGuideAt(x: number): void {
        this.addVerticalGuide(x);
    }

    private addHorizontalGuide(y: number): void {
        const guideContainer = new Container();

        // Visible guide line (thin)
        const graphic = new Graphics();
        graphic.rect(0, -this._guideThickness / 2, this._viewportWidth, this._guideThickness);
        graphic.fill({ color: this._guideColor, alpha: this._guideAlpha });

        // Hit area (larger, invisible)
        const hitArea = new Graphics();
        hitArea.rect(0, -this._hitAreaThickness / 2, this._viewportWidth, this._hitAreaThickness);
        hitArea.fill({ color: 0xff0000, alpha: 0 }); // Invisible
        hitArea.eventMode = 'static';
        hitArea.cursor = 'ns-resize';

        guideContainer.addChild(graphic);
        guideContainer.addChild(hitArea);
        guideContainer.position.y = y;

        const guide: Guide = { type: 'horizontal', position: y, graphic: guideContainer as any, hitArea };
        this.setupDrag(guide, guideContainer);
        this._guides.push(guide);
        this._container.addChild(guideContainer);
    }

    private addVerticalGuide(x: number): void {
        const guideContainer = new Container();

        // Visible guide line (thin)
        const graphic = new Graphics();
        graphic.rect(-this._guideThickness / 2, 0, this._guideThickness, this._viewportHeight);
        graphic.fill({ color: this._guideColor, alpha: this._guideAlpha });

        // Hit area (larger, invisible)
        const hitArea = new Graphics();
        hitArea.rect(-this._hitAreaThickness / 2, 0, this._hitAreaThickness, this._viewportHeight);
        hitArea.fill({ color: 0xff0000, alpha: 0 }); // Invisible
        hitArea.eventMode = 'static';
        hitArea.cursor = 'ew-resize';

        guideContainer.addChild(graphic);
        guideContainer.addChild(hitArea);
        guideContainer.position.x = x;

        const guide: Guide = { type: 'vertical', position: x, graphic: guideContainer as any, hitArea };
        this.setupDrag(guide, guideContainer);
        this._guides.push(guide);
        this._container.addChild(guideContainer);
    }

    private setupDrag(guide: Guide, guideContainer: Container): void {
        let isDragging = false;
        let startPos = 0;
        let startGuidePos = 0;

        const onPointerDown = (e: FederatedPointerEvent) => {
            isDragging = true;
            if (guide.type === 'horizontal') {
                startPos = e.global.y;
                startGuidePos = guideContainer.position.y;
            } else {
                startPos = e.global.x;
                startGuidePos = guideContainer.position.x;
            }
            // Visual feedback
            guideContainer.alpha = 1;
            guideContainer.children[0].alpha = 1; // Make line brighter
        };

        const onPointerMove = (e: FederatedPointerEvent) => {
            if (!isDragging) return;

            if (guide.type === 'horizontal') {
                const delta = e.global.y - startPos;
                const newY = startGuidePos + delta;
                guideContainer.position.y = newY;
                guide.position = newY;
            } else {
                const delta = e.global.x - startPos;
                const newX = startGuidePos + delta;
                guideContainer.position.x = newX;
                guide.position = newX;
            }
        };

        const onPointerUp = () => {
            if (isDragging) {
                isDragging = false;
                guideContainer.alpha = 1;
                guideContainer.children[0].alpha = this._guideAlpha;
            }
        };

        // Use the hit area for all pointer events
        guide.hitArea.on('pointerdown', onPointerDown);
        guide.hitArea.on('globalpointermove', onPointerMove);
        guide.hitArea.on('pointerup', onPointerUp);
        guide.hitArea.on('pointerupoutside', onPointerUp);

        // Also handle touch events explicitly
        guide.hitArea.on('touchstart', onPointerDown);
        guide.hitArea.on('touchmove', onPointerMove);
        guide.hitArea.on('touchend', onPointerUp);
        guide.hitArea.on('touchendoutside', onPointerUp);
    }

    private updateGuideSize(guide: Guide): void {
        const guideContainer = guide.graphic as unknown as Container;
        const visibleLine = guideContainer.children[0] as Graphics;
        const hitArea = guideContainer.children[1] as Graphics;

        visibleLine.clear();
        hitArea.clear();

        if (guide.type === 'horizontal') {
            visibleLine.rect(0, -this._guideThickness / 2, this._viewportWidth, this._guideThickness);
            visibleLine.fill({ color: this._guideColor, alpha: this._guideAlpha });
            hitArea.rect(0, -this._hitAreaThickness / 2, this._viewportWidth, this._hitAreaThickness);
            hitArea.fill({ color: 0xff0000, alpha: 0 });
        } else {
            visibleLine.rect(-this._guideThickness / 2, 0, this._guideThickness, this._viewportHeight);
            visibleLine.fill({ color: this._guideColor, alpha: this._guideAlpha });
            hitArea.rect(-this._hitAreaThickness / 2, 0, this._hitAreaThickness, this._viewportHeight);
            hitArea.fill({ color: 0xff0000, alpha: 0 });
        }
    }

    private removeLastGuide(): void {
        const guide = this._guides.pop();
        if (guide) {
            this._container.removeChild(guide.graphic);
            guide.graphic.destroy({ children: true });
        }
    }

    private removeAllGuides(): void {
        this._guides.forEach(guide => {
            this._container.removeChild(guide.graphic);
            guide.graphic.destroy({ children: true });
        });
        this._guides = [];
    }

    // Utility: Get current guides info
    public getGuidesInfo(): { horizontal: number[], vertical: number[] } {
        const horizontal: number[] = [];
        const vertical: number[] = [];

        this._guides.forEach(guide => {
            if (guide.type === 'horizontal') {
                horizontal.push(guide.position);
            } else {
                vertical.push(guide.position);
            }
        });

        return { horizontal, vertical };
    }
}
