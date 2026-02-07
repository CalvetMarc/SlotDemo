import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Layer } from '../Abstractions/Layer';
import { DesignCanvas } from '../Layout/DesignCanvas';
import { SingletonBase } from '../Abstractions/SingletonBase';
import { LayoutResolver } from '../Layout/LayoutConstraints';

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
  private layers: Map<string, Layer> = new Map();
  private layerConfigs: Map<string, LayerConfig> = new Map();
  private debugBorders: Map<string, Graphics> = new Map();
  private debugEnabled: boolean = false;
  private layoutDebugEnabled: boolean = false;
  private layoutDebugText: Text | null = null;
  private layoutDebugBg: Graphics | null = null;
  private currentViewport: { width: number; height: number } = { width: 0, height: 0 };
  private currentCanvas: DesignCanvas | null = null;

  // View registry for relativeTo lookups (viewId -> { view, layerId })
  private viewRegistry: Map<string, { view: Container; layerId: string }> = new Map();

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
      this.layers.set(config.id, layer);
      this.layerConfigs.set(config.id, config);
      this.root.addChild(layer);
    }
  }

  /**
   * Get a layer by ID
   */
  getLayer(id: string): Layer {
    const layer = this.layers.get(id);
    if (!layer) {
      throw new Error(
        `Layer "${id}" not found. Available layers: ${Array.from(this.layers.keys()).join(', ')}`
      );
    }
    return layer;
  }

  /**
   * Check if a layer exists
   */
  hasLayer(id: string): boolean {
    return this.layers.has(id);
  }

  /**
   * Get all layer IDs
   */
  getLayerIds(): string[] {
    return Array.from(this.layers.keys());
  }

  /**
   * Resize all layers with their respective scale modes
   */
  resize(viewportW: number, viewportH: number, canvas: DesignCanvas): void {
    this.currentViewport = { width: viewportW, height: viewportH };
    this.currentCanvas = canvas;

    for (const [layerId, layer] of this.layers) {
      const config = this.layerConfigs.get(layerId);
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
    for (const layer of this.layers.values()) {
      // Clear views but don't destroy the layer itself
      const viewIds = Object.keys(layer['layerViews']);
      for (const viewId of viewIds) {
        layer.removeView(viewId);
      }
    }
    // Clear the view registry
    this.viewRegistry.clear();
  }

  /**
   * Register a view for relativeTo lookups
   */
  registerView(viewId: string, view: Container, layerId?: string): void {
    this.viewRegistry.set(viewId, { view, layerId: layerId ?? '' });
  }

  /**
   * Unregister a view from relativeTo lookups
   */
  unregisterView(viewId: string): void {
    this.viewRegistry.delete(viewId);
  }

  /**
   * Get view bounds in GLOBAL/SCREEN space for relativeTo positioning.
   * Converts from layer-local coordinates to screen coordinates.
   * Returns null if view not found.
   */
  getViewBounds(viewId: string): { x: number; y: number; width: number; height: number } | null {
    const entry = this.viewRegistry.get(viewId);
    if (!entry) return null;

    const { view, layerId } = entry;
    const layer = this.layers.get(layerId);

    // Get local bounds at scale 1
    const viewScaleX = view.scale.x;
    const viewScaleY = view.scale.y;

    // Get bounds in local space
    const localBounds = view.getLocalBounds();

    // Calculate scaled dimensions at view level
    const scaledWidth = localBounds.width * viewScaleX;
    const scaledHeight = localBounds.height * viewScaleY;

    // Get pivot/origin offset
    const pivotX = (view.pivot?.x ?? 0) * viewScaleX;
    const pivotY = (view.pivot?.y ?? 0) * viewScaleY;

    // Calculate position in layer-local space considering pivot
    let localX = view.position.x - pivotX + (localBounds.x * viewScaleX);
    let localY = view.position.y - pivotY + (localBounds.y * viewScaleY);

    // Convert to global/screen coordinates using layer transform
    if (layer) {
      const layerScaleX = layer.scale.x;
      const layerScaleY = layer.scale.y;
      const layerPosX = layer.position.x;
      const layerPosY = layer.position.y;

      return {
        x: localX * layerScaleX + layerPosX,
        y: localY * layerScaleY + layerPosY,
        width: scaledWidth * layerScaleX,
        height: scaledHeight * layerScaleY
      };
    }

    // Fallback if layer not found
    return {
      x: localX,
      y: localY,
      width: scaledWidth,
      height: scaledHeight
    };
  }

  /**
   * Convert global/screen coordinates to a target layer's local coordinates.
   */
  globalToLayerLocal(
    globalBounds: { x: number; y: number; width: number; height: number },
    targetLayerId: string
  ): { x: number; y: number; width: number; height: number } {
    const layer = this.layers.get(targetLayerId);
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
    this.debugEnabled = !this.debugEnabled;
    if (this.debugEnabled) {
      this.showDebugBorders();
    } else {
      this.hideDebugBorders();
    }
  }

  /**
   * Show debug borders around each layer
   */
  private showDebugBorders(): void {
    for (const [layerId, layer] of this.layers) {
      const config = this.layerConfigs.get(layerId);
      if (!config) continue;

      // Create border graphics if not exists
      let border = this.debugBorders.get(layerId);
      if (!border) {
        border = new Graphics();
        this.debugBorders.set(layerId, border);
        layer.addChild(border);
      }

      // Get current canvas dimensions from layer
      const canvas = layer['currentCanvas'];
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
    for (const [layerId, border] of this.debugBorders) {
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
    if (!this.debugEnabled) return;

    for (const [layerId, border] of this.debugBorders) {
      const layer = this.layers.get(layerId);
      const layerCanvas = layer?.['currentCanvas'];
      if (layerCanvas) {
        this.drawLayerBorder(border, layerId, layerCanvas.width, layerCanvas.height);
      }
    }
  }

  /**
   * Toggle layout debug display
   */
  toggleLayoutDebug(): void {
    this.layoutDebugEnabled = !this.layoutDebugEnabled;
    if (this.layoutDebugEnabled) {
      this.showLayoutDebug();
    } else {
      this.hideLayoutDebug();
    }
  }

  /**
   * Show layout debug info in center of screen
   */
  private showLayoutDebug(): void {
    if (!this.layoutDebugText) {
      // Create background
      this.layoutDebugBg = new Graphics();
      this.layoutDebugBg.zIndex = 9999;
      this.root.addChild(this.layoutDebugBg);

      // Create text
      const style = new TextStyle({
        fontFamily: 'monospace',
        fontSize: 24,
        fontWeight: 'bold',
        fill: 0xffffff,
        align: 'center',
      });
      this.layoutDebugText = new Text({ text: '', style });
      this.layoutDebugText.anchor.set(0.5, 0.5);
      this.layoutDebugText.zIndex = 10000;
      this.root.addChild(this.layoutDebugText);
    }

    this.layoutDebugBg!.visible = true;
    this.layoutDebugText.visible = true;

    // Update immediately with current canvas
    if (this.currentCanvas) {
      this.updateLayoutDebug(this.currentCanvas);
    }
    console.log('📐 Layout debug: ON');
  }

  /**
   * Hide layout debug info
   */
  private hideLayoutDebug(): void {
    if (this.layoutDebugText) {
      this.layoutDebugText.visible = false;
    }
    if (this.layoutDebugBg) {
      this.layoutDebugBg.visible = false;
    }
    console.log('📐 Layout debug: OFF');
  }

  /**
   * Update layout debug display
   */
  private updateLayoutDebug(canvas: DesignCanvas): void {
    if (!this.layoutDebugEnabled || !this.layoutDebugText || !this.layoutDebugBg) return;

    const aspectKey = LayoutResolver.getAspectKey(canvas);
    const aspectRatio = (canvas.width / canvas.height).toFixed(2);
    const viewportAspect = (this.currentViewport.width / this.currentViewport.height).toFixed(2);

    const text = [
      `Layout: ${aspectKey}`,
      `Canvas: ${canvas.width}x${canvas.height} (${aspectRatio})`,
      `Viewport: ${this.currentViewport.width.toFixed(0)}x${this.currentViewport.height.toFixed(0)} (${viewportAspect})`,
    ].join('\n');

    this.layoutDebugText.text = text;

    // Position in center of viewport
    this.layoutDebugText.position.set(
      this.currentViewport.width / 2,
      this.currentViewport.height / 2
    );

    // Draw background
    const padding = 20;
    const bounds = this.layoutDebugText.getBounds();
    this.layoutDebugBg.clear();
    this.layoutDebugBg.roundRect(
      bounds.x - padding,
      bounds.y - padding,
      bounds.width + padding * 2,
      bounds.height + padding * 2,
      10
    );
    this.layoutDebugBg.fill({ color: 0x000000, alpha: 0.8 });
    this.layoutDebugBg.stroke({ width: 2, color: 0x00ff00 });
  }
}
