import { Application, Assets } from 'pixi.js';
import { ScreenManager } from './Core/Managers/screen-manager';
import { LayoutManager } from './Core/Managers/layout-manager';
import { CentralLayerManager } from './Core/Managers/central-layer-manager';
import { CANVAS_16_9, CANVAS_9_16, CANVAS_4_3 } from './Core/Layout/design-canvas';
import { GuideManager } from './Core/Debug/guide-manager';
import { SessionManager } from './Core/Game/SlotMachine/session-manager';

async function main() {

  // Initialize backend session (non-blocking if no backend)
  try {
    await SessionManager.init();
  } catch {
    console.warn('Backend not available — running in offline mode');
  }

  const app = new Application();
  await app.init({
    resizeTo: window,
    backgroundColor: 0x000000,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: true,
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
    { id: 'decoration', scaleMode: 'fill', zIndex: 5 },
    { id: 'game', scaleMode: 'contain', zIndex: 10 },
    { id: 'ui', scaleMode: 'fill', zIndex: 20 },
    { id: 'particles', scaleMode: 'cover', zIndex: 30 }
  ]);

  // Add layer manager root to layout manager root
  layoutManager.root.addChild(layerManager.root);
  app.stage.addChild(layoutManager.root);

  // Add guide manager for debug guides (G + Arrow keys)
  const guideManager = GuideManager.I;
  app.stage.addChild(guideManager.root);

  ScreenManager.I.init(app, layoutManager.root);
  await ScreenManager.I.start();

  layoutManager.onCanvasChanged = (canvas) => {
    ScreenManager.I.onLayoutChanged(canvas);
    // Resize layers - will use correct viewport after getViewportSize is defined
  };

  const doResize = (width: number, height: number) => {
    layoutManager.resize(width, height);
    const canvas = layoutManager.getCanvas();
    layerManager.resize(width, height, canvas);
    guideManager.setViewportSize(width, height);
  };

  // Get viewport dimensions - try visualViewport first, then fallback
  const getViewportSize = () => {
    // visualViewport gives CSS pixels in most cases
    if (window.visualViewport) {
      return { width: window.visualViewport.width, height: window.visualViewport.height };
    }
    // Fallback to document dimensions
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight
    };
  };

  // Use ResizeObserver
  const resizeObserver = new ResizeObserver(() => {
    const vp = getViewportSize();
    if (vp.width > 0 && vp.height > 0) {
      doResize(vp.width, vp.height);
    }
  });
  resizeObserver.observe(app.canvas);

  // Also listen to visualViewport resize if available
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      const vp = getViewportSize();
      if (vp.width > 0 && vp.height > 0) {
        doResize(vp.width, vp.height);
      }
    });
  }

  // Initial resize
  const initialVp = getViewportSize();
  doResize(initialVp.width, initialVp.height);
  ScreenManager.I.onLayoutChanged(layoutManager.getCanvas());

  // Debug shortcuts:
  // - D: Toggle layer borders
  // - L: Toggle layout debug info
  // - G + ArrowUp: Add horizontal guide at y=0
  // - G + ArrowLeft: Add vertical guide at x=0
  // - G + ArrowDown: Add horizontal guide at center
  // - G + ArrowRight: Add vertical guide at center
  // - G + Delete: Remove last guide
  // - G + Escape: Remove all guides
  window.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
      layerManager.toggleDebugBorders();
    }
    if (e.key === 'l' || e.key === 'L') {
      layerManager.toggleLayoutDebug();
    }
  });
}

main();

