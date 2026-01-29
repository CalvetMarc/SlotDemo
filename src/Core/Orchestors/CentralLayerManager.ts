import { Container } from 'pixi.js';
import { Layer } from '../Abstractions/Layer';
import { DesignCanvas } from '../Layout/DesignCanvas';
import { SingletonBase } from '../Abstractions/SingletonBase';

export type LayerScaleMode = 'cover' | 'contain';

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

      // Calculate scale based on layer's scale mode
      const scale = this.calculateLayerScale(
        config.scaleMode,
        viewportW,
        viewportH,
        canvas
      );

      // Apply scale to layer
      layer.scale.set(scale, scale);

      // Center layer in viewport
      const scaledW = canvas.width * scale;
      const scaledH = canvas.height * scale;
      layer.position.set(
        (viewportW - scaledW) * 0.5,
        (viewportH - scaledH) * 0.5
      );

      // Notify layer of canvas change and update view layouts
      layer.onLayoutChanged(canvas);
      layer.updateViewLayouts(canvas);
    }
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
}
