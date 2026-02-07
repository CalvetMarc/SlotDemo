import { Container, Graphics, FederatedPointerEvent, Rectangle } from 'pixi.js';

interface Guide {
    type: 'horizontal' | 'vertical';
    position: number;
    graphic: Graphics;
    hitArea: Graphics;
}

export class GuideManager {
    private static instance: GuideManager;
    private container: Container;
    private guides: Guide[] = [];
    private isGKeyDown: boolean = false;
    private guideColor: number = 0x00ff00;
    private guideAlpha: number = 0.8;
    private guideThickness: number = 2;
    private hitAreaThickness: number = 30; // Larger hit area for easier grabbing on mobile
    private viewportWidth: number = 800;
    private viewportHeight: number = 600;

    private constructor() {
        this.container = new Container();
        this.container.zIndex = 9999; // Always on top
        this.container.sortableChildren = true;
        this.setupKeyboardListeners();
    }

    static get I(): GuideManager {
        if (!GuideManager.instance) {
            GuideManager.instance = new GuideManager();
        }
        return GuideManager.instance;
    }

    get root(): Container {
        return this.container;
    }

    setViewportSize(width: number, height: number): void {
        this.viewportWidth = width;
        this.viewportHeight = height;
        // Update all guides to span the full viewport
        this.guides.forEach(guide => this.updateGuideSize(guide));
    }

    private setupKeyboardListeners(): void {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'g' || e.key === 'G') {
                this.isGKeyDown = true;
            }

            if (this.isGKeyDown) {
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.addHorizontalGuide(0);
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.addVerticalGuide(0);
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.addHorizontalGuide(this.viewportHeight / 2);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    this.addVerticalGuide(this.viewportWidth / 2);
                } else if (e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    this.removeLastGuide();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.removeAllGuides();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'g' || e.key === 'G') {
                this.isGKeyDown = false;
            }
        });
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
        graphic.rect(0, -this.guideThickness / 2, this.viewportWidth, this.guideThickness);
        graphic.fill({ color: this.guideColor, alpha: this.guideAlpha });

        // Hit area (larger, invisible)
        const hitArea = new Graphics();
        hitArea.rect(0, -this.hitAreaThickness / 2, this.viewportWidth, this.hitAreaThickness);
        hitArea.fill({ color: 0xff0000, alpha: 0 }); // Invisible
        hitArea.eventMode = 'static';
        hitArea.cursor = 'ns-resize';

        guideContainer.addChild(graphic);
        guideContainer.addChild(hitArea);
        guideContainer.position.y = y;

        const guide: Guide = { type: 'horizontal', position: y, graphic: guideContainer as any, hitArea };
        this.setupDrag(guide, guideContainer);
        this.guides.push(guide);
        this.container.addChild(guideContainer);

        console.log(`[GuideManager] Added horizontal guide at y=${y}`);
    }

    private addVerticalGuide(x: number): void {
        const guideContainer = new Container();

        // Visible guide line (thin)
        const graphic = new Graphics();
        graphic.rect(-this.guideThickness / 2, 0, this.guideThickness, this.viewportHeight);
        graphic.fill({ color: this.guideColor, alpha: this.guideAlpha });

        // Hit area (larger, invisible)
        const hitArea = new Graphics();
        hitArea.rect(-this.hitAreaThickness / 2, 0, this.hitAreaThickness, this.viewportHeight);
        hitArea.fill({ color: 0xff0000, alpha: 0 }); // Invisible
        hitArea.eventMode = 'static';
        hitArea.cursor = 'ew-resize';

        guideContainer.addChild(graphic);
        guideContainer.addChild(hitArea);
        guideContainer.position.x = x;

        const guide: Guide = { type: 'vertical', position: x, graphic: guideContainer as any, hitArea };
        this.setupDrag(guide, guideContainer);
        this.guides.push(guide);
        this.container.addChild(guideContainer);

        console.log(`[GuideManager] Added vertical guide at x=${x}`);
    }

    private setupDrag(guide: Guide, guideContainer: Container): void {
        let dragging = false;
        let startPos = 0;
        let startGuidePos = 0;

        const onPointerDown = (e: FederatedPointerEvent) => {
            dragging = true;
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
            if (!dragging) return;

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
            if (dragging) {
                dragging = false;
                guideContainer.alpha = 1;
                guideContainer.children[0].alpha = this.guideAlpha;
                if (guide.type === 'horizontal') {
                    console.log(`[GuideManager] Horizontal guide moved to y=${guide.position.toFixed(1)}`);
                } else {
                    console.log(`[GuideManager] Vertical guide moved to x=${guide.position.toFixed(1)}`);
                }
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
            visibleLine.rect(0, -this.guideThickness / 2, this.viewportWidth, this.guideThickness);
            visibleLine.fill({ color: this.guideColor, alpha: this.guideAlpha });
            hitArea.rect(0, -this.hitAreaThickness / 2, this.viewportWidth, this.hitAreaThickness);
            hitArea.fill({ color: 0xff0000, alpha: 0 });
        } else {
            visibleLine.rect(-this.guideThickness / 2, 0, this.guideThickness, this.viewportHeight);
            visibleLine.fill({ color: this.guideColor, alpha: this.guideAlpha });
            hitArea.rect(-this.hitAreaThickness / 2, 0, this.hitAreaThickness, this.viewportHeight);
            hitArea.fill({ color: 0xff0000, alpha: 0 });
        }
    }

    private removeLastGuide(): void {
        const guide = this.guides.pop();
        if (guide) {
            this.container.removeChild(guide.graphic);
            guide.graphic.destroy({ children: true });
            console.log(`[GuideManager] Removed last guide`);
        }
    }

    private removeAllGuides(): void {
        this.guides.forEach(guide => {
            this.container.removeChild(guide.graphic);
            guide.graphic.destroy({ children: true });
        });
        this.guides = [];
        console.log(`[GuideManager] Removed all guides`);
    }

    // Utility: Get current guides info
    public getGuidesInfo(): { horizontal: number[], vertical: number[] } {
        const horizontal: number[] = [];
        const vertical: number[] = [];

        this.guides.forEach(guide => {
            if (guide.type === 'horizontal') {
                horizontal.push(guide.position);
            } else {
                vertical.push(guide.position);
            }
        });

        return { horizontal, vertical };
    }
}
