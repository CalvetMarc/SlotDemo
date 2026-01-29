import { Application, Assets } from 'pixi.js';
import { ScreenManager } from './Core/Orchestors/ScreenManager';
import { LayoutManager } from './Core/Orchestors/LayoutManager';
import { CentralLayerManager } from './Core/Orchestors/CentralLayerManager';
import { CANVAS_16_9, CANVAS_9_16, CANVAS_4_3 } from './Core/Layout/DesignCanvas';

async function main() {

  const app = new Application();
  await app.init({
    resizeTo: window,
    backgroundColor: 0x000000,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  document.body.appendChild(app.canvas);

  await Assets.init({
    manifest: 'assets_manifest.json'
  });

  // Initialize canvas selection manager
  const layoutManager = new LayoutManager([
    CANVAS_16_9,
    CANVAS_9_16,
    CANVAS_4_3
  ]);

  // Initialize central layer manager with default layers
  const layerManager = CentralLayerManager.I;
  layerManager.initializeLayers([
    { id: 'background', scaleMode: 'cover', zIndex: 0 },
    { id: 'game', scaleMode: 'contain', zIndex: 10 },
    { id: 'ui', scaleMode: 'contain', zIndex: 20 },
    { id: 'particles', scaleMode: 'cover', zIndex: 30 }
  ]);

  // Add layer manager root to layout manager root
  layoutManager.root.addChild(layerManager.root);
  app.stage.addChild(layoutManager.root);

  ScreenManager.I.init(app, layoutManager.root);
  await ScreenManager.I.start();

  layoutManager.onCanvasChanged = (canvas) => {
    ScreenManager.I.onLayoutChanged(canvas);
    // Resize layers when canvas changes
    layerManager.resize(window.innerWidth, window.innerHeight, canvas);
  };

  const onResize = () => {
    layoutManager.resize(window.innerWidth, window.innerHeight);
    const canvas = layoutManager.getCanvas();
    layerManager.resize(window.innerWidth, window.innerHeight, canvas);
  };

  window.addEventListener('resize', onResize);
  onResize();
  ScreenManager.I.onLayoutChanged(layoutManager.getCanvas());
}

main();

