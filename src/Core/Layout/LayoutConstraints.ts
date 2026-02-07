import { DesignCanvas } from "./DesignCanvas";

export type LayoutAnchor =
  | "center"
  | "top-left" | "top-center" | "top-right"
  | "middle-left" | "middle-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export type OffsetValue = number | string;
export type ScaleValue = number | string;

export type ScaleMode = "contain" | "cover" | "fill";

export interface LayoutConstraint {
  anchor: LayoutAnchor;
  offset?: { x?: OffsetValue; y?: OffsetValue };
  scale?: { x?: ScaleValue; y?: ScaleValue };
  scaleMode?: ScaleMode;
  maxScale?: number;
  minScale?: number;
  minMargin?: { x?: OffsetValue; y?: OffsetValue }; // Margin in pixels or percentage
  rotation?: number;
  origin?: { x?: number; y?: number };
  // Relative positioning: position relative to another view instead of canvas
  relativeTo?: string;  // ID of the target view to position relative to
  relativeAnchor?: LayoutAnchor;  // Which point of the target view to anchor to (default: same as anchor)
  relativeOffset?: { x?: OffsetValue; y?: OffsetValue };  // Offset calculated from target's dimensions (w%/h% = target width/height)
  relativeAxis?: 'x' | 'y' | 'xy';  // Which axis to position relative to target (default: 'xy' = both)
}

export type LayoutAspectKey = "16:9" | "9:16" | "4:3";

export interface LayoutConfig {
  default: LayoutConstraint;
  overrides?: Partial<Record<LayoutAspectKey, LayoutConstraint>>;
}

/** Target with optional sprite-like properties for layout resolution */
interface LayoutTarget {
    position: { set(x: number, y: number): void; x: number; y: number };
    scale: { x: number; y: number; set(x: number, y: number): void };
    rotation: number;
    pivot?: { set(x: number, y: number): void };
    anchor?: { set(x: number, y: number): void };
    texture?: { width: number; height: number };
    children?: LayoutTarget[];
    width?: number;
    height?: number;
    getLocalBounds?: () => { x: number; y: number; width: number; height: number };
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

    const override = layout.overrides?.[aspectKey];

    if (override) {
      return {
        anchor: override.anchor ?? layout.default.anchor,
        offset: override.offset ?? layout.default.offset,
        scale: override.scale ?? layout.default.scale,
        scaleMode: override.scaleMode ?? layout.default.scaleMode,
        maxScale: override.maxScale ?? layout.default.maxScale,
        minScale: override.minScale ?? layout.default.minScale,
        minMargin: override.minMargin ?? layout.default.minMargin,
        rotation: override.rotation ?? layout.default.rotation,
        origin: override.origin ?? layout.default.origin,
        relativeTo: override.relativeTo ?? layout.default.relativeTo,
        relativeAnchor: override.relativeAnchor ?? layout.default.relativeAnchor,
        relativeOffset: override.relativeOffset ?? layout.default.relativeOffset,
        relativeAxis: override.relativeAxis ?? layout.default.relativeAxis
      };
    }

    return layout.default;
  }

  /**
   * Check if a layout configuration uses relativeTo positioning.
   * Used to determine if layout needs to be applied in second pass.
   */
  static usesRelativeTo(layout: LayoutConfig, canvas: DesignCanvas): boolean {
    const constraint = this.resolveConstraint(layout, canvas);
    return constraint.relativeTo !== undefined;
  }

  /**
   * Parse offset value with w% and h% units.
   * - Number: direct pixel value
   * - "50w%": 50% of canvas width
   * - "50h%": 50% of canvas height
   */
  private static parseOffsetValue(
    value: OffsetValue | undefined,
    canvasWidth: number,
    canvasHeight: number
  ): number {
    if (value === undefined) return 0;

    if (typeof value === 'number') {
      return value;
    }

    // Parse w% (width percentage)
    const widthMatch = value.match(/^(-?\d+(?:\.\d+)?)w%$/);
    if (widthMatch) {
      const percentage = parseFloat(widthMatch[1]);
      return (percentage / 100) * canvasWidth;
    }

    // Parse h% (height percentage)
    const heightMatch = value.match(/^(-?\d+(?:\.\d+)?)h%$/);
    if (heightMatch) {
      const percentage = parseFloat(heightMatch[1]);
      return (percentage / 100) * canvasHeight;
    }

    // Plain number (pixels)
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Parse scale value with support for w% and h% units.
   * - Number: direct scale multiplier (e.g., 0.5 = half size)
   * - "50w%": scale so view width = 50% of canvas width
   * - "50h%": scale so view height = 50% of canvas height
   */
  private static parseScaleValue(
    value: ScaleValue | undefined,
    viewDimension: number,
    canvasWidth: number,
    canvasHeight: number
  ): number | null {
    if (value === undefined) return null;

    if (typeof value === 'number') {
      return value;
    }

    // Parse w% (width percentage)
    const widthMatch = value.match(/^(-?\d+(?:\.\d+)?)w%$/);
    if (widthMatch) {
      const percentage = parseFloat(widthMatch[1]);
      const targetSize = (percentage / 100) * canvasWidth;
      return viewDimension > 0 ? targetSize / viewDimension : 1;
    }

    // Parse h% (height percentage)
    const heightMatch = value.match(/^(-?\d+(?:\.\d+)?)h%$/);
    if (heightMatch) {
      const percentage = parseFloat(heightMatch[1]);
      const targetSize = (percentage / 100) * canvasHeight;
      return viewDimension > 0 ? targetSize / viewDimension : 1;
    }

    // Try to parse as plain number
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  static calculateAutoScale(
    viewWidth: number,
    viewHeight: number,
    canvasWidth: number,
    canvasHeight: number,
    scaleMode: ScaleMode,
    maxScale?: number,
    minScale?: number
  ): { x: number; y: number } {
    if (viewWidth === 0 || viewHeight === 0) {
      return { x: 1, y: 1 };
    }

    const scaleX = canvasWidth / viewWidth;
    const scaleY = canvasHeight / viewHeight;

    let finalScaleX: number;
    let finalScaleY: number;

    switch (scaleMode) {
      case "contain":
        // Scale to fit inside canvas (letterbox/pillarbox)
        const containScale = Math.min(scaleX, scaleY);
        finalScaleX = finalScaleY = containScale;
        break;

      case "cover":
        // Scale to cover entire canvas (may crop)
        const coverScale = Math.max(scaleX, scaleY);
        finalScaleX = finalScaleY = coverScale;
        break;

      case "fill":
        // Stretch to fill canvas (may distort)
        finalScaleX = scaleX;
        finalScaleY = scaleY;
        break;

      default:
        finalScaleX = finalScaleY = 1;
    }

    // Apply scale limits
    if (maxScale !== undefined) {
      finalScaleX = Math.min(finalScaleX, maxScale);
      finalScaleY = Math.min(finalScaleY, maxScale);
    }

    if (minScale !== undefined) {
      finalScaleX = Math.max(finalScaleX, minScale);
      finalScaleY = Math.max(finalScaleY, minScale);
    }

    return { x: finalScaleX, y: finalScaleY };
  }

  static calculatePosition(anchor: LayoutAnchor, canvas: DesignCanvas, offset: { x?: OffsetValue; y?: OffsetValue } = {}): { x: number; y: number } {
    const { width, height } = canvas;
    const offsetX = this.parseOffsetValue(offset.x, width, height);
    const offsetY = this.parseOffsetValue(offset.y, width, height);

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

  /**
   * Calculate position relative to another view's bounds.
   * @param anchor - Which point of the target view to position at
   * @param targetBounds - The bounds of the target view in canvas space
   * @param offset - Additional offset from the anchor point (percentages based on canvas)
   * @param relativeOffset - Offset based on target's dimensions (w% = target width, h% = target height)
   * @param canvasWidth - Canvas width for percentage calculations
   * @param canvasHeight - Canvas height for percentage calculations
   */
  static calculatePositionRelativeTo(
    anchor: LayoutAnchor,
    targetBounds: { x: number; y: number; width: number; height: number },
    offset: { x?: OffsetValue; y?: OffsetValue } = {},
    relativeOffset: { x?: OffsetValue; y?: OffsetValue } | undefined,
    canvasWidth: number,
    canvasHeight: number
  ): { x: number; y: number } {
    // Regular offset uses canvas dimensions
    const offsetX = this.parseOffsetValue(offset.x, canvasWidth, canvasHeight);
    const offsetY = this.parseOffsetValue(offset.y, canvasWidth, canvasHeight);

    // Relative offset uses target's dimensions (w% = target width, h% = target height)
    const relOffsetX = relativeOffset ? this.parseOffsetValue(relativeOffset.x, targetBounds.width, targetBounds.height) : 0;
    const relOffsetY = relativeOffset ? this.parseOffsetValue(relativeOffset.y, targetBounds.width, targetBounds.height) : 0;

    // Combine both offsets
    const totalOffsetX = offsetX + relOffsetX;
    const totalOffsetY = offsetY + relOffsetY;

    const { x, y, width, height } = targetBounds;

    switch (anchor) {
      case "center":
        return { x: x + width / 2 + totalOffsetX, y: y + height / 2 + totalOffsetY };

      case "top-left":
        return { x: x + totalOffsetX, y: y + totalOffsetY };

      case "top-center":
        return { x: x + width / 2 + totalOffsetX, y: y + totalOffsetY };

      case "top-right":
        return { x: x + width + totalOffsetX, y: y + totalOffsetY };

      case "middle-left":
        return { x: x + totalOffsetX, y: y + height / 2 + totalOffsetY };

      case "middle-right":
        return { x: x + width + totalOffsetX, y: y + height / 2 + totalOffsetY };

      case "bottom-left":
        return { x: x + totalOffsetX, y: y + height + totalOffsetY };

      case "bottom-center":
        return { x: x + width / 2 + totalOffsetX, y: y + height + totalOffsetY };

      case "bottom-right":
        return { x: x + width + totalOffsetX, y: y + height + totalOffsetY };

      default:
        return { x: x + width / 2 + totalOffsetX, y: y + height / 2 + totalOffsetY };
    }
  }

  /**
   * Type for view lookup function used with relativeTo positioning.
   * Returns the global bounds of a view by its ID.
   */
  static applyLayout(
    target: LayoutTarget,
    layout: LayoutConfig,
    canvas: DesignCanvas,
    viewLookup?: (viewId: string) => { x: number; y: number; width: number; height: number } | null
  ): void {
    const constraint = this.resolveConstraint(layout, canvas);

    // Calculate position - either relative to another view or to canvas
    let position: { x: number; y: number };

    if (constraint.relativeTo && viewLookup) {
      const targetBounds = viewLookup(constraint.relativeTo);
      if (targetBounds) {
        // Use relativeAnchor if specified, otherwise use the same anchor
        const relativeAnchor = constraint.relativeAnchor ?? constraint.anchor;
        const relativeAxis = constraint.relativeAxis ?? 'xy';

        const relativePos = this.calculatePositionRelativeTo(
          relativeAnchor,
          targetBounds,
          constraint.offset,
          constraint.relativeOffset,
          canvas.width,
          canvas.height
        );

        if (relativeAxis === 'xy') {
          // Both axes relative to target
          position = relativePos;
        } else {
          // Only one axis relative - get canvas position for the other axis
          const canvasPos = this.calculatePosition(constraint.anchor, canvas, constraint.offset);
          position = {
            x: relativeAxis === 'x' ? relativePos.x : canvasPos.x,
            y: relativeAxis === 'y' ? relativePos.y : canvasPos.y
          };
        }

      } else {
        console.warn(`LayoutResolver: relativeTo target "${constraint.relativeTo}" not found, falling back to canvas positioning`);
        position = this.calculatePosition(constraint.anchor, canvas, constraint.offset);
      }
    } else {
      position = this.calculatePosition(constraint.anchor, canvas, constraint.offset);
    }

    // Step 1: Get actual content dimensions (needed for both pivot and scaleMode)
    let viewWidth = 0;
    let viewHeight = 0;

    // Try to get dimensions from sprite texture first (most reliable)
    if (target.texture?.width && target.texture?.height) {
      viewWidth = target.texture.width;
      viewHeight = target.texture.height;
    }
    // Try children with textures (for containers with sprites)
    else if (target.children && target.children.length > 0) {
      for (const child of target.children) {
        if (child.texture?.width && child.texture?.height) {
          viewWidth = child.texture.width;
          viewHeight = child.texture.height;
          break;
        }
      }
    }

    // If still no dimensions found, try getLocalBounds
    if (viewWidth === 0 && viewHeight === 0 && target.getLocalBounds) {
      const currentScaleX = target.scale.x ?? 1;
      const currentScaleY = target.scale.y ?? 1;
      target.scale.set(1, 1);

      const bounds = target.getLocalBounds();
      viewWidth = bounds.width;
      viewHeight = bounds.height;

      target.scale.set(currentScaleX, currentScaleY);
    }

    // Last resort: use width/height properties
    if (viewWidth === 0 && viewHeight === 0 && target.width && target.height) {
      viewWidth = target.width / (target.scale.x || 1);
      viewHeight = target.height / (target.scale.y || 1);
    }

    // Step 2: Apply origin
    if (constraint.origin) {
      const originX = constraint.origin.x ?? 0.5;
      const originY = constraint.origin.y ?? 0.5;

      // Check if target is a Sprite (has anchor property directly)
      if (target.anchor && typeof target.anchor.set === 'function') {
        // Direct sprite: use anchor (0-1 range)
        target.anchor.set(originX, originY);
      }
      // Container: use pivot based on local bounds
      else if (target.pivot && target.getLocalBounds) {
        const bounds = target.getLocalBounds();
        const pivotX = bounds.x + originX * bounds.width;
        const pivotY = bounds.y + originY * bounds.height;
        target.pivot.set(pivotX, pivotY);
      }
    }

    // Step 3: Calculate scale (position will be applied after potential margin adjustments)
    let finalScale: { x: number; y: number };

    if (constraint.scaleMode && viewWidth > 0 && viewHeight > 0) {
      // Auto-scale mode (contain/cover/fill)
      finalScale = this.calculateAutoScale(
        viewWidth,
        viewHeight,
        canvas.width,
        canvas.height,
        constraint.scaleMode,
        constraint.maxScale,
        constraint.minScale
      );
    } else if (constraint.scale) {
      // Manual scale with optional minMargin adjustment
      // Parse scale values (supports w% and h% units)
      const parsedScaleX = this.parseScaleValue(
        constraint.scale.x,
        viewWidth,
        canvas.width,
        canvas.height
      );
      const parsedScaleY = this.parseScaleValue(
        constraint.scale.y,
        viewHeight,
        canvas.width,
        canvas.height
      );

      let scaleX = parsedScaleX ?? 1;
      let scaleY = parsedScaleY ?? 1;

      // Determine uniform scale based on the type of percentage used
      // If using height percentage (h%), prefer the height-based scale
      // If using width percentage (w%), prefer the width-based scale
      let uniformScale: number;
      const scaleYStr = String(constraint.scale.y ?? '');
      const scaleXStr = String(constraint.scale.x ?? '');

      if (scaleYStr.includes('h%')) {
        // Height-based scaling: use scaleY to ensure height matches the percentage
        uniformScale = scaleY;
      } else if (scaleXStr.includes('w%')) {
        // Width-based scaling: use scaleX to ensure width matches the percentage
        uniformScale = scaleX;
      } else {
        // Default: use minimum to fit within bounds (preserve aspect ratio)
        uniformScale = Math.min(scaleX, scaleY);
      }

      // Apply maxScale limit
      if (constraint.maxScale !== undefined && uniformScale > constraint.maxScale) {
        uniformScale = constraint.maxScale;
      }

      // Apply minMargin constraints with push-before-scale strategy
      if (constraint.minMargin && viewWidth > 0 && viewHeight > 0) {
        const marginX = this.parseOffsetValue(constraint.minMargin.x, canvas.width, canvas.height);
        const marginY = this.parseOffsetValue(constraint.minMargin.y, canvas.width, canvas.height);

        const MARGIN_EPSILON = 0.1;
        if (marginX > MARGIN_EPSILON || marginY > MARGIN_EPSILON) {
          // Calculate available space with margins
          const availableWidth = canvas.width - (2 * marginX);
          const availableHeight = canvas.height - (2 * marginY);

          const originX = constraint.origin?.x ?? 0.5;
          const originY = constraint.origin?.y ?? 0.5;

          const scaledWidth = viewWidth * uniformScale;
          const scaledHeight = viewHeight * uniformScale;

          // First check if element fits within available space
          // If not, must reduce scale before attempting to push
          let needsScaleReduction = false;
          if (marginX > MARGIN_EPSILON && scaledWidth > availableWidth) {
            needsScaleReduction = true;
          }
          if (marginY > MARGIN_EPSILON && scaledHeight > availableHeight) {
            needsScaleReduction = true;
          }

          // Debug: log for character_bats to diagnose minMargin issue
          const isDebugView = constraint.scale &&
            String(constraint.scale.x).includes('50h%') &&
            String(constraint.offset?.x ?? '').includes('80h%');
          if (isDebugView) {
            console.log(`[minMargin DEBUG] marginX=${marginX}, availableWidth=${availableWidth.toFixed(0)}, ` +
              `scaledWidth=${scaledWidth.toFixed(0)}, needsScaleReduction=${needsScaleReduction}, ` +
              `uniformScale before=${uniformScale.toFixed(4)}`);
          }

          if (needsScaleReduction) {
            // Element too large, reduce scale to fit
            let maxScaleFit = uniformScale;
            if (marginX > MARGIN_EPSILON && availableWidth > 0) {
              maxScaleFit = Math.min(maxScaleFit, availableWidth / viewWidth);
            }
            if (marginY > MARGIN_EPSILON && availableHeight > 0) {
              maxScaleFit = Math.min(maxScaleFit, availableHeight / viewHeight);
            }
            uniformScale = Math.max(0, maxScaleFit);

            if (isDebugView) {
              console.log(`[minMargin DEBUG] scale reduced to ${uniformScale.toFixed(4)}, ` +
                `maxScaleFit=${maxScaleFit.toFixed(4)}`);
            }
          }

          // Recalculate bounds with (possibly reduced) scale
          const finalScaledWidth = viewWidth * uniformScale;
          const finalScaledHeight = viewHeight * uniformScale;

          const left = position.x - (finalScaledWidth * originX);
          const right = position.x + (finalScaledWidth * (1 - originX));
          const top = position.y - (finalScaledHeight * originY);
          const bottom = position.y + (finalScaledHeight * (1 - originY));

          // Calculate push needed to respect margins (check both sides independently)
          let pushX = 0;
          let pushY = 0;

          if (marginX > MARGIN_EPSILON) {
            const leftViolation = marginX - left;
            const rightViolation = right - (canvas.width - marginX);

            if (leftViolation > 0 && rightViolation > 0) {
              // Both sides violated - center the element
              pushX = (leftViolation - rightViolation) / 2;
            } else if (leftViolation > 0) {
              pushX = leftViolation;
            } else if (rightViolation > 0) {
              pushX = -rightViolation;
            }
          }

          if (marginY > MARGIN_EPSILON) {
            const topViolation = marginY - top;
            const bottomViolation = bottom - (canvas.height - marginY);

            if (topViolation > 0 && bottomViolation > 0) {
              // Both sides violated - center the element
              pushY = (topViolation - bottomViolation) / 2;
            } else if (topViolation > 0) {
              pushY = topViolation;
            } else if (bottomViolation > 0) {
              pushY = -bottomViolation;
            }
          }

          // Apply push
          if (pushX !== 0 || pushY !== 0) {
            position.x += pushX;
            position.y += pushY;
          }

          // Debug: final position for character_bats (recalculate bounds AFTER push)
          if (isDebugView) {
            const finalLeft = position.x - (finalScaledWidth * originX);
            const finalRight = position.x + (finalScaledWidth * (1 - originX));
            console.log(`[minMargin DEBUG] final pos=(${position.x.toFixed(0)}, ${position.y.toFixed(0)}), ` +
              `pushX=${pushX.toFixed(1)}, FINAL bounds: L=${finalLeft.toFixed(0)} R=${finalRight.toFixed(0)}, ` +
              `canvas=${canvas.width.toFixed(0)}, gap=${(canvas.width - finalRight).toFixed(1)}px`);
          }

          // Apply minScale limit
          if (constraint.minScale !== undefined && uniformScale < constraint.minScale) {
            uniformScale = constraint.minScale;
          }
        }
      }

      // Apply uniform scale to maintain aspect ratio
      finalScale = { x: uniformScale, y: uniformScale };
    } else {
      // Default scale
      finalScale = { x: 1, y: 1 };
    }

    // Apply position (after margin adjustments) and scale
    target.position.set(position.x, position.y);
    target.scale.set(finalScale.x, finalScale.y);

    if (constraint.rotation !== undefined) {
      target.rotation = constraint.rotation;
    }
  }
}
