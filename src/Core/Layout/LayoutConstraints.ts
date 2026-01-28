import { DesignCanvas } from "./DesignCanvas";

export type LayoutAnchor =
  | "center"
  | "top-left" | "top-center" | "top-right"
  | "middle-left" | "middle-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export type OffsetValue = number | string;  // number = pixels, string = percentage (e.g., "50%")

export interface LayoutConstraint {
  anchor: LayoutAnchor;
  offset?: { x?: OffsetValue; y?: OffsetValue };
  scale?: { x?: number; y?: number };
  rotation?: number;
  origin?: { x?: number; y?: number };  // Pivot point of the view (PixiJS anchor)
}

export type LayoutAspectKey = "16:9" | "9:16" | "4:3";

export interface LayoutConfig {
  default: LayoutConstraint;
  overrides?: Partial<Record<LayoutAspectKey, LayoutConstraint>>;
}

export class LayoutResolver {

  static getAspectKey(canvas: DesignCanvas): LayoutAspectKey {
    const aspect = canvas.aspect;

    if (Math.abs(aspect - 16/9) < 0.01) return "16:9";
    if (Math.abs(aspect - 9/16) < 0.01) return "9:16";
    if (Math.abs(aspect - 4/3) < 0.01) return "4:3";

    // Fallback: choose closest
    const distances = {
      "16:9": Math.abs(aspect - 16/9),
      "9:16": Math.abs(aspect - 9/16),
      "4:3": Math.abs(aspect - 4/3)
    };

    return Object.entries(distances).sort(([,a], [,b]) => a - b)[0][0] as LayoutAspectKey;
  }

  static resolveConstraint(layout: LayoutConfig, canvas: DesignCanvas): LayoutConstraint {
    const aspectKey = this.getAspectKey(canvas);

    // Check if there's an override for this aspect ratio
    const override = layout.overrides?.[aspectKey];

    if (override) {
      // Merge override with default (override takes priority)
      return {
        anchor: override.anchor ?? layout.default.anchor,
        offset: override.offset ?? layout.default.offset,
        scale: override.scale ?? layout.default.scale,
        rotation: override.rotation ?? layout.default.rotation,
        origin: override.origin ?? layout.default.origin
      };
    }

    return layout.default;
  }

  private static parseOffsetValue(value: OffsetValue | undefined, dimension: number): number {
    if (value === undefined) return 0;

    if (typeof value === 'string') {
      // Parse percentage (e.g., "50%", "-25%")
      const match = value.match(/^(-?\d+(?:\.\d+)?)%$/);
      if (match) {
        const percentage = parseFloat(match[1]);
        return (percentage / 100) * dimension;
      }
      // If not a valid percentage, try to parse as number
      return parseFloat(value) || 0;
    }

    return value;
  }

  static calculatePosition(anchor: LayoutAnchor, canvas: DesignCanvas, offset: { x?: OffsetValue; y?: OffsetValue } = {}): { x: number; y: number } {
    const { width, height } = canvas;
    const offsetX = this.parseOffsetValue(offset.x, width);
    const offsetY = this.parseOffsetValue(offset.y, height);

    switch (anchor) {
      case "center":
        return { x: width / 2 + offsetX, y: height / 2 + offsetY };

      case "top-left":
        return { x: 0 + offsetX, y: 0 + offsetY };

      case "top-center":
        return { x: width / 2 + offsetX, y: 0 + offsetY };

      case "top-right":
        return { x: width + offsetX, y: 0 + offsetY };

      case "middle-left":
        return { x: 0 + offsetX, y: height / 2 + offsetY };

      case "middle-right":
        return { x: width + offsetX, y: height / 2 + offsetY };

      case "bottom-left":
        return { x: 0 + offsetX, y: height + offsetY };

      case "bottom-center":
        return { x: width / 2 + offsetX, y: height + offsetY };

      case "bottom-right":
        return { x: width + offsetX, y: height + offsetY };

      default:
        return { x: width / 2 + offsetX, y: height / 2 + offsetY };
    }
  }

  static applyLayout(
    target: {
      position: { set(x: number, y: number): void };
      scale: { set(x: number, y: number): void };
      rotation: number;
      pivot?: { set(x: number, y: number): void };
      children?: any[];
    },
    layout: LayoutConfig,
    canvas: DesignCanvas
  ): void {
    const constraint = this.resolveConstraint(layout, canvas);
    const position = this.calculatePosition(constraint.anchor, canvas, constraint.offset);

    // Apply origin to sprites/children with anchor property
    if (constraint.origin) {
      // Try to apply origin to direct children that have anchor property (like Sprites)
      if (target.children) {
        for (const child of target.children) {
          if (child.anchor && typeof child.anchor.set === 'function') {
            child.anchor.set(
              constraint.origin.x ?? 0,
              constraint.origin.y ?? 0
            );
          }
        }
      }

      // Also apply as pivot to the container itself for rotation/scale purposes
      if (target.pivot) {
        target.pivot.set(
          constraint.origin.x ?? 0,
          constraint.origin.y ?? 0
        );
      }
    }

    target.position.set(position.x, position.y);

    if (constraint.scale) {
      target.scale.set(
        constraint.scale.x ?? 1,
        constraint.scale.y ?? 1
      );
    }

    if (constraint.rotation !== undefined) {
      target.rotation = constraint.rotation;
    }
  }
}
