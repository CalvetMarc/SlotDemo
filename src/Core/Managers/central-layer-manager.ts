import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Layer } from '../Abstractions/layer';
import { DesignCanvas } from '../Layout/design-canvas';
import { SingletonBase } from '../Abstractions/singleton-base';
import { LayoutResolver } from '../Layout/layout-constraints';

export type LayerScaleMode = 'cover' | 'contain' | 'fill';

export interface LayerConfig {
  id: string;
  scaleMode: LayerScaleMode;
  zIndex: number;
}

/**
 * Central manager for all game layers.
 * Layers are shared across screens and each has its own scale mode.
 * - 'cover': Fills viewport completely (may crop, used for backgrounds)
 * - 'contain': Fits completely in viewport (may letterbox, used for UI/game)
 */
export class CentralLayerManager extends SingletonBase {
  public readonly root = new Container();
  private _layers: Map<string, Layer> = new Map();
  private _layerConfigs: Map<string, LayerConfig> = new Map();
  private _debugBorders: Map<string, Graphics> = new Map();
  private _isDebugEnabled: boolean = false;
  private _isLayoutDebugEnabled: boolean = false;
  private _layoutDebugText: Text | null = null;
  private _layoutDebugBg: Graphics | null = null;
  private _currentViewport: { width: number; height: number } = { width: 0, height: 0 };
  private _currentCanvas: DesignCanvas | null = null;

  // View registry for relativeTo lookups (viewId -> { view, layerId })
  private _viewRegistry: Map<string, { view: Container; layerId: string }> = new Map();

  // Bounds cache: invalidated at the start of each resize cycle
  private _boundsCache: Map<string, { x: number; y: number; width: number; height: number }> = new Map();

  // Colors for each layer border
  private readonly layerColors: Record<string, number> = {
    'background': 0xff00ff,  // Magenta
    'decoration': 0xff0000,  // Red
    'game': 0x00ff00,        // Green
    'ui': 0x0000ff,          // Blue
    'particles': 0xffff00    // Yellow
  };

  protected constructor() {
    super();
    this.root.sortableChildren = true;
  }

  public static get I(): CentralLayerManager {
    return super.getInstance<CentralLayerManager>();
  }

  /**
   * Initialize layers with their scale modes
   */
  initializeLayers(configs: LayerConfig[]): void {
    // Sort by zIndex
    configs.sort((a, b) => a.zIndex - b.zIndex);

    for (const config of configs) {
      const layer = new Layer(config.id, config.zIndex);
      this._layers.set(config.id, layer);
      this._layerConfigs.set(config.id, config);
      this.root.addChild(layer);
    }
  }

  /**
   * Get a layer by ID
   */
  getLayer(id: string): Layer {
    const layer = this._layers.get(id);
    if (!layer) {
      throw new Error(
        `Layer "${id}" not found. Available layers: ${Array.from(this._layers.keys()).join(', ')}`
      );
    }
    return layer;
  }

  /**
   * Check if a layer exists
   */
  hasLayer(id: string): boolean {
    return this._layers.has(id);
  }

  /**
   * Get all layer IDs
   */
  getLayerIds(): string[] {
    return Array.from(this._layers.keys());
  }

  /**
   * Resize all layers with their respective scale modes
   */
  resize(viewportW: number, viewportH: number, canvas: DesignCanvas): void {
    this._currentViewport = { width: viewportW, height: viewportH };
    this._currentCanvas = canvas;
    this._boundsCache.clear();

    for (const [layerId, layer] of this._layers) {
      const config = this._layerConfigs.get(layerId);
      if (!config) continue;

      if (config.scaleMode === 'fill') {
        // Fill mode: layer matches viewport exactly
        layer.scale.set(1, 1);
        layer.position.set(0, 0);

        // Create viewport-sized canvas for fill layers
        const viewportCanvas: DesignCanvas = {
          width: viewportW,
          height: viewportH,
          aspect: viewportW / viewportH
        };
        layer.onLayoutChanged(viewportCanvas);
        layer.updateViewLayouts(viewportCanvas);
      } else {
        // Cover/Contain mode
        const scale = this.calculateLayerScale(
          config.scaleMode,
          viewportW,
          viewportH,
          canvas
        );

        layer.scale.set(scale, scale);

        const scaledW = canvas.width * scale;
        const scaledH = canvas.height * scale;
        layer.position.set(
          (viewportW - scaledW) * 0.5,
          (viewportH - scaledH) * 0.5
        );

        layer.onLayoutChanged(canvas);
        layer.updateViewLayouts(canvas);
      }
    }

    // Update debug borders if enabled
    this.updateDebugBorders(canvas);

    // Update layout debug if enabled
    this.updateLayoutDebug(canvas);
  }

  /**
   * Calculate scale for a layer based on its scale mode
   */
  private calculateLayerScale(
    mode: LayerScaleMode,
    viewportW: number,
    viewportH: number,
    canvas: DesignCanvas
  ): number {
    const scaleX = viewportW / canvas.width;
    const scaleY = viewportH / canvas.height;

    switch (mode) {
      case 'cover':
        // Fill viewport (may crop)
        return Math.max(scaleX, scaleY);
      case 'contain':
        // Fit in viewport (may letterbox)
        return Math.min(scaleX, scaleY);
      default:
        return 1;
    }
  }

  /**
   * Clear all views from all layers (useful for screen transitions)
   */
  clearAllViews(): void {
    for (const layer of this._layers.values()) {
      // Clear views but don't destroy the layer itself
      const viewIds = Object.keys(layer.getViews());
      for (const viewId of viewIds) {
        layer.removeView(viewId);
      }
    }
    // Clear the view registry
    this._viewRegistry.clear();
  }

  /**
   * Register a view for relativeTo lookups
   */
  registerView(viewId: string, view: Container, layerId?: string): void {
    this._viewRegistry.set(viewId, { view, layerId: layerId ?? '' });
  }

  /**
   * Unregister a view from relativeTo lookups
   */
  unregisterView(viewId: string): void {
    this._viewRegistry.delete(viewId);
  }

  /**
   * Get view bounds in GLOBAL/SCREEN space for relativeTo positioning.
   * Converts from layer-local coordinates to screen coordinates.
   * Returns null if view not found.
   */
  getViewBounds(viewId: string): { x: number; y: number; width: number; height: number } | null {
    // Return cached bounds if available (cache is cleared at start of each resize)
    const cached = this._boundsCache.get(viewId);
    if (cached) return cached;

    const entry = this._viewRegistry.get(viewId);
    if (!entry) return null;

    const { view, layerId } = entry;
    const layer = this._layers.get(layerId);

    // Get local bounds at scale 1
    const viewScaleX = view.scale.x;
    const viewScaleY = view.scale.y;

    // Use cached intrinsic size if available, otherwise compute
    const viewWithCache = view as { _cachedIntrinsicSize?: { bounds: { x: number; y: number; width: number; height: number } } };
    const localBounds = viewWithCache._cachedIntrinsicSize?.bounds ?? view.getLocalBounds();

    // Calculate scaled dimensions at view level
    const scaledWidth = localBounds.width * viewScaleX;
    const scaledHeight = localBounds.height * viewScaleY;

    // Get pivot/origin offset
    const pivotX = (view.pivot?.x ?? 0) * viewScaleX;
    const pivotY = (view.pivot?.y ?? 0) * viewScaleY;

    // Calculate position in layer-local space considering pivot
    const localX = view.position.x - pivotX + (localBounds.x * viewScaleX);
    const localY = view.position.y - pivotY + (localBounds.y * viewScaleY);

    let result: { x: number; y: number; width: number; height: number };

    // Convert to global/screen coordinates using layer transform
    if (layer) {
      const layerScaleX = layer.scale.x;
      const layerScaleY = layer.scale.y;
      const layerPosX = layer.position.x;
      const layerPosY = layer.position.y;

      result = {
        x: localX * layerScaleX + layerPosX,
        y: localY * layerScaleY + layerPosY,
        width: scaledWidth * layerScaleX,
        height: scaledHeight * layerScaleY
      };
    } else {
      result = {
        x: localX,
        y: localY,
        width: scaledWidth,
        height: scaledHeight
      };
    }

    this._boundsCache.set(viewId, result);
    return result;
  }

  /**
   * Convert global/screen coordinates to a target layer's local coordinates.
   */
  globalToLayerLocal(
    globalBounds: { x: number; y: number; width: number; height: number },
    targetLayerId: string
  ): { x: number; y: number; width: number; height: number } {
    const layer = this._layers.get(targetLayerId);
    if (!layer) return globalBounds;

    const layerScaleX = layer.scale.x;
    const layerScaleY = layer.scale.y;
    const layerPosX = layer.position.x;
    const layerPosY = layer.position.y;

    return {
      x: (globalBounds.x - layerPosX) / layerScaleX,
      y: (globalBounds.y - layerPosY) / layerScaleY,
      width: globalBounds.width / layerScaleX,
      height: globalBounds.height / layerScaleY
    };
  }

  /**
   * Create a view lookup function for use with LayoutResolver.applyLayout.
   * If targetLayerId is provided, coordinates are converted to that layer's local space.
   */
  createViewLookup(targetLayerId?: string): (viewId: string) => { x: number; y: number; width: number; height: number } | null {
    return (viewId: string) => {
      const globalBounds = this.getViewBounds(viewId);
      if (!globalBounds) return null;

      // If target layer specified, convert global to that layer's local space
      if (targetLayerId) {
        return this.globalToLayerLocal(globalBounds, targetLayerId);
      }

      return globalBounds;
    };
  }

  /**
   * Toggle debug borders visibility
   */
  toggleDebugBorders(): void {
    this._isDebugEnabled = !this._isDebugEnabled;
    if (this._isDebugEnabled) {
      this.showDebugBorders();
    } else {
      this.hideDebugBorders();
    }
  }

  /**
   * Show debug borders around each layer
   */
  private showDebugBorders(): void {
    for (const [layerId, layer] of this._layers) {
      const config = this._layerConfigs.get(layerId);
      if (!config) continue;

      // Create border graphics if not exists
      let border = this._debugBorders.get(layerId);
      if (!border) {
        border = new Graphics();
        this._debugBorders.set(layerId, border);
        layer.addChild(border);
      }

      // Get current canvas dimensions from layer
      const canvas = layer.getCurrentCanvas();
      if (canvas) {
        this.drawLayerBorder(border, layerId, canvas.width, canvas.height);
      }
    }
    console.log('🔲 Debug borders: ON');
  }

  /**
   * Hide debug borders
   */
  private hideDebugBorders(): void {
    for (const [layerId, border] of this._debugBorders) {
      border.clear();
    }
    console.log('🔲 Debug borders: OFF');
  }

  /**
   * Draw border for a specific layer
   */
  private drawLayerBorder(graphics: Graphics, layerId: string, width: number, height: number): void {
    const color = this.layerColors[layerId] || 0xffffff;

    graphics.clear();
    graphics.rect(0, 0, width, height);
    graphics.stroke({ width: 4, color: color });
  }

  /**
   * Update debug borders (call after resize)
   */
  updateDebugBorders(canvas: DesignCanvas): void {
    if (!this._isDebugEnabled) return;

    for (const [layerId, border] of this._debugBorders) {
      const layer = this._layers.get(layerId);
      const layerCanvas = layer?.getCurrentCanvas();
      if (layerCanvas) {
        this.drawLayerBorder(border, layerId, layerCanvas.width, layerCanvas.height);
      }
    }
  }

  /**
   * Toggle layout debug display
   */
  toggleLayoutDebug(): void {
    this._isLayoutDebugEnabled = !this._isLayoutDebugEnabled;
    if (this._isLayoutDebugEnabled) {
      this.showLayoutDebug();
    } else {
      this.hideLayoutDebug();
    }
  }

  /**
   * Show layout debug info in center of screen
   */
  private showLayoutDebug(): void {
    if (!this._layoutDebugText) {
      // Create background
      this._layoutDebugBg = new Graphics();
      this._layoutDebugBg.zIndex = 9999;
      this.root.addChild(this._layoutDebugBg);

      // Create text
      const style = new TextStyle({
        fontFamily: 'monospace',
        fontSize: 24,
        fontWeight: 'bold',
        fill: 0xffffff,
        align: 'center',
      });
      this._layoutDebugText = new Text({ text: '', style });
      this._layoutDebugText.anchor.set(0.5, 0.5);
      this._layoutDebugText.zIndex = 10000;
      this.root.addChild(this._layoutDebugText);
    }

    this._layoutDebugBg!.visible = true;
    this._layoutDebugText.visible = true;

    // Update immediately with current canvas
    if (this._currentCanvas) {
      this.updateLayoutDebug(this._currentCanvas);
    }
    console.log('📐 Layout debug: ON');
  }

  /**
   * Hide layout debug info
   */
  private hideLayoutDebug(): void {
    if (this._layoutDebugText) {
      this._layoutDebugText.visible = false;
    }
    if (this._layoutDebugBg) {
      this._layoutDebugBg.visible = false;
    }
    console.log('📐 Layout debug: OFF');
  }

  /**
   * Update layout debug display
   */
  private updateLayoutDebug(canvas: DesignCanvas): void {
    if (!this._isLayoutDebugEnabled || !this._layoutDebugText || !this._layoutDebugBg) return;

    const aspectKey = LayoutResolver.getAspectKey(canvas);
    const aspectRatio = (canvas.width / canvas.height).toFixed(2);
    const viewportAspect = (this._currentViewport.width / this._currentViewport.height).toFixed(2);

    const text = [
      `Layout: ${aspectKey}`,
      `Canvas: ${canvas.width}x${canvas.height} (${aspectRatio})`,
      `Viewport: ${this._currentViewport.width.toFixed(0)}x${this._currentViewport.height.toFixed(0)} (${viewportAspect})`,
    ].join('\n');

    this._layoutDebugText.text = text;

    // Position in center of viewport
    this._layoutDebugText.position.set(
      this._currentViewport.width / 2,
      this._currentViewport.height / 2
    );

    // Draw background
    const padding = 20;
    const bounds = this._layoutDebugText.getBounds();
    this._layoutDebugBg.clear();
    this._layoutDebugBg.roundRect(
      bounds.x - padding,
      bounds.y - padding,
      bounds.width + padding * 2,
      bounds.height + padding * 2,
      10
    );
    this._layoutDebugBg.fill({ color: 0x000000, alpha: 0.8 });
    this._layoutDebugBg.stroke({ width: 2, color: 0x00ff00 });
  }
}
