import { Application, Assets } from 'pixi.js';
import { ScreenManager } from './Core/Orchestors/ScreenManager';
import { LayoutManager } from './Core/Orchestors/LayoutManager';
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
 
  const layoutManager = new LayoutManager([
    CANVAS_16_9,
    CANVAS_9_16,
    CANVAS_4_3
  ]);
  app.stage.addChild(layoutManager.root);

  ScreenManager.I.init(app, layoutManager.root);
  await ScreenManager.I.start(); 

  layoutManager.onCanvasChanged = (canvas) => {
    ScreenManager.I.onLayoutChanged(canvas);
  };

  const onResize = () => {
    layoutManager.resize(window.innerWidth, window.innerHeight);
  };

  window.addEventListener('resize', onResize);
  onResize();
  ScreenManager.I.onLayoutChanged(layoutManager.getCanvas());
}

main();

