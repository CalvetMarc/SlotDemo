import { View, bundle } from "./View";
import { Graphics, Rectangle, Circle, Ellipse, Polygon } from "pixi.js";

/** Interface for button mouse events - implement to customize behavior */
export interface IButtonEvents {
    onMouseEnter?(): void;
    onMouseLeave?(): void;
    onMouseClick?(): void;
}

/** Base class for interactive buttons with hover tint effect */
export abstract class ButtonView extends View implements IButtonEvents {
    protected hoverTint: number = 0x888888;  // Darken on hover
    protected normalTint: number = 0xffffff;  // No tint modification (original color)
    protected isHovered: boolean = false;
    private debugBoundsGraphic?: Graphics;

    abstract bundleNeeded(): bundle;
    abstract appear(): void;

    /** Called after appear() to set up button interactivity */
    protected setupInteractivity(): void {
        this.eventMode = 'static';
        this.cursor = 'pointer';

        this.on('pointerover', () => this.handleMouseEnter());
        this.on('pointerout', () => this.handleMouseLeave());
        this.on('pointerdown', () => this.handleMouseClick());
    }

    private handleMouseEnter(): void {
        this.isHovered = true;
        this.applyHoverTint();
        this.onMouseEnter?.();
    }

    private handleMouseLeave(): void {
        this.isHovered = false;
        this.removeHoverTint();
        this.onMouseLeave?.();
    }

    private handleMouseClick(): void {
        this.onMouseClick?.();
    }

    /** Override to apply tint to specific elements (default: tints this container) */
    protected applyHoverTint(): void {
        this.tint = this.hoverTint;
    }

    /** Override to remove tint from specific elements */
    protected removeHoverTint(): void {
        this.tint = this.normalTint;
    }

    /** Shows debug bounds visualization of the actual hit areas. */
    protected showDebugBounds(enabled: boolean): void {
        if (!enabled) return;

        // Remove existing debug graphic if any
        if (this.debugBoundsGraphic) {
            this.removeChild(this.debugBoundsGraphic);
            this.debugBoundsGraphic.destroy();
        }

        this.debugBoundsGraphic = new Graphics();
        let shapeDrawn = false;

        // Priority 1: Check if hitArea is explicitly set
        if (this.hitArea) {
            if (this.hitArea instanceof Rectangle) {
                this.debugBoundsGraphic.rect(this.hitArea.x, this.hitArea.y, this.hitArea.width, this.hitArea.height);
                shapeDrawn = true;
            } else if (this.hitArea instanceof Circle) {
                this.debugBoundsGraphic.circle(this.hitArea.x, this.hitArea.y, this.hitArea.radius);
                shapeDrawn = true;
            } else if (this.hitArea instanceof Ellipse) {
                this.debugBoundsGraphic.ellipse(this.hitArea.x, this.hitArea.y, this.hitArea.halfWidth, this.hitArea.halfHeight);
                shapeDrawn = true;
            } else if (this.hitArea instanceof Polygon) {
                this.debugBoundsGraphic.poly(this.hitArea.points);
                shapeDrawn = true;
            }
        }

        // Priority 2: Extract shapes from Graphics children
        if (!shapeDrawn) {
            for (const child of this.children) {
                if (child instanceof Graphics && child !== this.debugBoundsGraphic) {
                    const context = (child as any).context;

                    if (context && context.instructions) {
                        for (const instruction of context.instructions) {
                            if (instruction.data && instruction.data.path) {
                                const path = instruction.data.path;

                                if (path.shapePath && path.shapePath.shapePrimitives) {
                                    for (const primitive of path.shapePath.shapePrimitives) {
                                        if (primitive.shape) {
                                            const shape = primitive.shape;
                                            // Draw based on shape type
                                            if (shape.radius !== undefined) {
                                                // Circle
                                                this.debugBoundsGraphic.circle(shape.x, shape.y, shape.radius);
                                                shapeDrawn = true;
                                            } else if (shape.halfWidth !== undefined) {
                                                // Ellipse
                                                this.debugBoundsGraphic.ellipse(shape.x, shape.y, shape.halfWidth, shape.halfHeight);
                                                shapeDrawn = true;
                                            } else if (shape.width !== undefined) {
                                                // Rectangle
                                                this.debugBoundsGraphic.rect(shape.x, shape.y, shape.width, shape.height);
                                                shapeDrawn = true;
                                            } else if (shape.points !== undefined) {
                                                // Polygon
                                                this.debugBoundsGraphic.poly(shape.points);
                                                shapeDrawn = true;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Fallback: Use container bounds as rectangle
        if (!shapeDrawn) {
            const bounds = this.getLocalBounds();
            this.debugBoundsGraphic.rect(bounds.x, bounds.y, bounds.width, bounds.height);
        }

        this.debugBoundsGraphic.stroke({ color: 0xff0000, width: 2, alpha: 0.8 });
        this.debugBoundsGraphic.fill({ color: 0xff0000, alpha: 0.2 });

        // Disable events so debug graphic doesn't affect hit detection
        this.debugBoundsGraphic.eventMode = 'none';

        this.addChild(this.debugBoundsGraphic);
    }

    // Optional event handlers - override in subclasses
    onMouseEnter?(): void;
    onMouseLeave?(): void;
    onMouseClick?(): void;
}
