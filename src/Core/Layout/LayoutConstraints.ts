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
        origin: override.origin ?? layout.default.origin
      };
    }

    return layout.default;
  }

  /**
   * Parse offset value with w% and h% units.
   * - Number: direct pixel value
   * - "50w%": 50% of layer width
   * - "50h%": 50% of layer height
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

    // Try to parse as plain number
    return parseFloat(value) || 0;
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

    console.log(`[AutoScale] scaleX=${scaleX.toFixed(3)} (${canvasWidth}/${viewWidth}), scaleY=${scaleY.toFixed(3)} (${canvasHeight}/${viewHeight})`);

    let finalScaleX: number;
    let finalScaleY: number;

    switch (scaleMode) {
      case "contain":
        // Scale to fit inside canvas (letterbox/pillarbox)
        const containScale = Math.min(scaleX, scaleY);
        finalScaleX = finalScaleY = containScale;
        console.log(`[AutoScale] contain → ${containScale.toFixed(3)}`);
        break;

      case "cover":
        // Scale to cover entire canvas (may crop)
        const coverScale = Math.max(scaleX, scaleY);
        finalScaleX = finalScaleY = coverScale;
        console.log(`[AutoScale] cover → ${coverScale.toFixed(3)} BEFORE maxScale`);
        break;

      case "fill":
        // Stretch to fill canvas (may distort)
        finalScaleX = scaleX;
        finalScaleY = scaleY;
        console.log(`[AutoScale] fill → (${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`);
        break;

      default:
        finalScaleX = finalScaleY = 1;
    }

    // Apply scale limits
    if (maxScale !== undefined) {
      const beforeX = finalScaleX;
      const beforeY = finalScaleY;
      finalScaleX = Math.min(finalScaleX, maxScale);
      finalScaleY = Math.min(finalScaleY, maxScale);
      if (beforeX !== finalScaleX || beforeY !== finalScaleY) {
        console.log(`[AutoScale] maxScale=${maxScale} CLAMPED: (${beforeX.toFixed(3)}, ${beforeY.toFixed(3)}) → (${finalScaleX.toFixed(3)}, ${finalScaleY.toFixed(3)})`);
      } else {
        console.log(`[AutoScale] maxScale=${maxScale} NOT applied (scale below limit)`);
      }
    }

    if (minScale !== undefined) {
      finalScaleX = Math.max(finalScaleX, minScale);
      finalScaleY = Math.max(finalScaleY, minScale);
      console.log(`[AutoScale] minScale=${minScale} checked`);
    }

    console.log(`[AutoScale] FINAL: (${finalScaleX.toFixed(3)}, ${finalScaleY.toFixed(3)})`);
    const scaledWidth = viewWidth * finalScaleX;
    const scaledHeight = viewHeight * finalScaleY;
    console.log(`[AutoScale] Scaled dimensions: ${scaledWidth.toFixed(0)}x${scaledHeight.toFixed(0)} (should cover ${canvasWidth}x${canvasHeight})`);

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

  static applyLayout(
    target: {
      position: { set(x: number, y: number): void };
      scale: { x: number; y: number; set(x: number, y: number): void };
      rotation: number;
      pivot?: { set(x: number, y: number): void };
      children?: any[];
      width?: number;
      height?: number;
      getLocalBounds?: () => { width: number; height: number };
    },
    layout: LayoutConfig,
    canvas: DesignCanvas
  ): void {
    const constraint = this.resolveConstraint(layout, canvas);
    const position = this.calculatePosition(constraint.anchor, canvas, constraint.offset);

    // Step 1: Get actual content dimensions (needed for both pivot and scaleMode)
    let viewWidth = 0;
    let viewHeight = 0;

    // Try to get dimensions from sprite texture first (most reliable)
    if ((target as any).texture?.width && (target as any).texture?.height) {
      viewWidth = (target as any).texture.width;
      viewHeight = (target as any).texture.height;
    }
    // Try children with textures (for containers with sprites)
    else if (target.children && target.children.length > 0) {
      for (const child of target.children) {
        if ((child as any).texture?.width && (child as any).texture?.height) {
          viewWidth = (child as any).texture.width;
          viewHeight = (child as any).texture.height;
          break;
        }
      }
    }
    // Fallback to bounds
    else if (target.getLocalBounds) {
      const currentScaleX = target.scale.x ?? 1;
      const currentScaleY = target.scale.y ?? 1;
      target.scale.set(1, 1);

      const bounds = target.getLocalBounds();
      viewWidth = bounds.width;
      viewHeight = bounds.height;

      target.scale.set(currentScaleX, currentScaleY);
    }
    // Last resort: use width/height properties
    else if (target.width && target.height) {
      viewWidth = target.width / (target.scale.x || 1);
      viewHeight = target.height / (target.scale.y || 1);
    }

    console.log(`[DimensionDetect] View dimensions: ${viewWidth}x${viewHeight}`);

    // Step 2: Apply origin
    if (constraint.origin) {
      const originX = constraint.origin.x ?? 0.5;
      const originY = constraint.origin.y ?? 0.5;

      // Check if target is a Sprite (has anchor property directly)
      if ((target as any).anchor && typeof (target as any).anchor.set === 'function') {
        // Direct sprite: use anchor (0-1 range)
        (target as any).anchor.set(originX, originY);
        console.log(`Origin applied to sprite anchor: (${originX}, ${originY})`);
      }
      // Container: use pivot based on local bounds
      else if (target.pivot && target.getLocalBounds) {
        const bounds = (target as any).getLocalBounds();
        const pivotX = bounds.x + originX * bounds.width;
        const pivotY = bounds.y + originY * bounds.height;
        target.pivot.set(pivotX, pivotY);
        console.log(`Origin applied to container pivot: (${pivotX.toFixed(1)}, ${pivotY.toFixed(1)}) from bounds (${bounds.x}, ${bounds.y}, ${bounds.width}, ${bounds.height})`);
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

      // Debug log
      console.log(`Layout: pos(${position.x}, ${position.y}) scale(${finalScale.x.toFixed(3)}, ${finalScale.y.toFixed(3)}) view(${viewWidth}x${viewHeight}) canvas(${canvas.width}x${canvas.height})`);
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

      // Assume uniform scale initially (preserve aspect ratio)
      let uniformScale = Math.min(scaleX, scaleY);

      // Apply minMargin constraints with push-before-scale strategy
      if (constraint.minMargin && viewWidth > 0 && viewHeight > 0) {
        const marginX = this.parseOffsetValue(constraint.minMargin.x, canvas.width, canvas.height);
        const marginY = this.parseOffsetValue(constraint.minMargin.y, canvas.width, canvas.height);
        console.log(`[MinMargin] Raw config: x="${constraint.minMargin.x}", y="${constraint.minMargin.y}"`);
        console.log(`[MinMargin] Parsed margins: X=${marginX.toFixed(2)}px, Y=${marginY.toFixed(2)}px`);

        const MARGIN_EPSILON = 0.1;
        if (marginX > MARGIN_EPSILON || marginY > MARGIN_EPSILON) {
          // Calculate object bounds with requested scale
          const originX = constraint.origin?.x ?? 0.5;
          const originY = constraint.origin?.y ?? 0.5;

          const scaledWidth = viewWidth * uniformScale;
          const scaledHeight = viewHeight * uniformScale;

          // Calculate bounds based on position and origin
          const left = position.x - (scaledWidth * originX);
          const right = position.x + (scaledWidth * (1 - originX));
          const top = position.y - (scaledHeight * originY);
          const bottom = position.y + (scaledHeight * (1 - originY));

          console.log(`[MinMargin] Object bounds: L=${left.toFixed(1)} R=${right.toFixed(1)} T=${top.toFixed(1)} B=${bottom.toFixed(1)}`);
          console.log(`[MinMargin] Canvas: 0 to ${canvas.width} (W) × 0 to ${canvas.height} (H)`);

          // Check margin violations
          let pushX = 0;
          let pushY = 0;

          if (marginX > MARGIN_EPSILON) {
            if (left < marginX) {
              pushX = marginX - left;
              console.log(`[MinMargin] Left violation: ${left.toFixed(1)} < ${marginX.toFixed(1)}, pushX=+${pushX.toFixed(1)}`);
            } else if (right > canvas.width - marginX) {
              pushX = (canvas.width - marginX) - right;
              console.log(`[MinMargin] Right violation: ${right.toFixed(1)} > ${(canvas.width - marginX).toFixed(1)}, pushX=${pushX.toFixed(1)}`);
            }
          }

          if (marginY > MARGIN_EPSILON) {
            if (top < marginY) {
              pushY = marginY - top;
              console.log(`[MinMargin] Top violation: ${top.toFixed(1)} < ${marginY.toFixed(1)}, pushY=+${pushY.toFixed(1)}`);
            } else if (bottom > canvas.height - marginY) {
              pushY = (canvas.height - marginY) - bottom;
              console.log(`[MinMargin] Bottom violation: ${bottom.toFixed(1)} > ${(canvas.height - marginY).toFixed(1)}, pushY=${pushY.toFixed(1)}`);
            }
          }

          // Try to push first
          if (pushX !== 0 || pushY !== 0) {
            const newLeft = left + pushX;
            const newRight = right + pushX;
            const newTop = top + pushY;
            const newBottom = bottom + pushY;

            // Check if pushing keeps object within canvas bounds
            const canPush = newLeft >= 0 && newRight <= canvas.width &&
                           newTop >= 0 && newBottom <= canvas.height;

            if (canPush) {
              // Apply push by adjusting position
              position.x += pushX;
              position.y += pushY;
              console.log(`[MinMargin] ✓ Pushed object: (${pushX.toFixed(1)}, ${pushY.toFixed(1)}), new pos: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
            } else {
              // Can't push, must reduce scale
              console.log(`[MinMargin] ✗ Cannot push (would exit canvas), reducing scale instead`);

              const availableWidth = canvas.width - (2 * marginX);
              const availableHeight = canvas.height - (2 * marginY);

              let maxScaleFit = uniformScale;
              if (marginX > MARGIN_EPSILON) maxScaleFit = Math.min(maxScaleFit, availableWidth / viewWidth);
              if (marginY > MARGIN_EPSILON) maxScaleFit = Math.min(maxScaleFit, availableHeight / viewHeight);

              uniformScale = maxScaleFit;
              console.log(`[MinMargin] Scale reduced to: ${uniformScale.toFixed(3)}`);
            }
          } else {
            console.log(`[MinMargin] No margin violations, object fits`);
          }

          // Apply minScale limit
          if (constraint.minScale !== undefined && uniformScale < constraint.minScale) {
            console.log(`[MinMargin] Applying minScale limit: ${uniformScale.toFixed(3)} → ${constraint.minScale}`);
            uniformScale = constraint.minScale;
          }
        }
      }

      // Apply uniform scale to maintain aspect ratio
      finalScale = { x: uniformScale, y: uniformScale };
      console.log(`Layout (manual): pos(${position.x}, ${position.y}) scale(${finalScale.x.toFixed(3)}, ${finalScale.y.toFixed(3)})`);
    } else {
      // Default scale
      finalScale = { x: 1, y: 1 };
    }

    // Apply position (after margin adjustments) and scale
    target.position.set(position.x, position.y);
    target.scale.set(finalScale.x, finalScale.y);
    console.log(`[ApplyLayout] Final pos: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}), scale: (${target.scale.x.toFixed(3)}, ${target.scale.y.toFixed(3)})`);

    if (constraint.rotation !== undefined) {
      target.rotation = constraint.rotation;
    }
  }
}
