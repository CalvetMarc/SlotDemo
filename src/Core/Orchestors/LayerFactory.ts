import { Layer } from "../Abstractions/Layer";
import { BackgroundLayer } from "../Game/Layers/BackgroundLayer";
import { GameLayer } from "../Game/Layers/GameLayer";
import { ForegroundLayer } from "../Game/Layers/ForegroundLayer";
import { ParticleLayer } from "../Game/Layers/ParticleLayer";
import { UiLayer } from "../Game/Layers/UiLayer";
import { ModalLayer } from "../Game/Layers/ModalLayer";
import { DebugLayer } from "../Game/Layers/DebugLayer";

export interface LayerConfig {
  id: string;
  layer: Layer;
  zIndex: number;
}

/** Factory for creating layer instances. */
export class LayerFactory {
  /** Creates the default 7-layer setup (background, game, foreground, particles, ui, modal, debug). */
  static createDefaultLayers(): LayerConfig[] {
    return [
      { id: 'background', layer: new BackgroundLayer(0), zIndex: 0 },
      { id: 'game', layer: new GameLayer(1), zIndex: 1 },
      { id: 'foreground', layer: new ForegroundLayer(2), zIndex: 2 },
      { id: 'particles', layer: new ParticleLayer(4), zIndex: 4 },
      { id: 'ui', layer: new UiLayer(5), zIndex: 5 },
      { id: 'modal', layer: new ModalLayer(6), zIndex: 6 },
      { id: 'debug', layer: new DebugLayer(7), zIndex: 7 }
    ];
  }

  /** Creates a minimal 3-layer setup (background, game, ui). */
  static createMinimalLayers(): LayerConfig[] {
    return [
      { id: 'background', layer: new BackgroundLayer(0), zIndex: 0 },
      { id: 'game', layer: new GameLayer(1), zIndex: 1 },
      { id: 'ui', layer: new UiLayer(5), zIndex: 5 }
    ];
  }
}
