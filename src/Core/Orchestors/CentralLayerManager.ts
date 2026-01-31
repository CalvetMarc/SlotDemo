import { Container, Graphics } from 'pixi.js';
import { Layer } from '../Abstractions/Layer';
import { DesignCanvas } from '../Layout/DesignCanvas';
import { SingletonBase } from '../Abstractions/SingletonBase';

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
}
