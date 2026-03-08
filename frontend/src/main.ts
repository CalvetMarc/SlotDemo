import { Application, Assets } from 'pixi.js';
import { ScreenManager } from './Core/Managers/screen-manager';
import { LayoutManager } from './Core/Managers/layout-manager';
import { CentralLayerManager } from './Core/Managers/central-layer-manager';
import { CANVAS_16_9, CANVAS_9_16, CANVAS_4_3 } from './Core/Layout/design-canvas';
import { GuideManager } from './Core/Debug/guide-manager';
import { SessionManager } from './Core/Game/SlotMachine/session-manager';
import { IS_DEBUG } from './Core/Utils/env';
import { AudioManager } from './Core/Audio/audio-manager';

async function main() {

  const app = new Application();
  await app.init({
    resizeTo: window,
    backgroundColor: 0x000000,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: true,
  });

  document.body.appendChild(app.canvas);

  // Handle WebGL context loss (iOS Safari under memory pressure)
  const canvas = app.canvas as HTMLCanvasElement;
  canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('[WebGL] Context lost');
  });
  canvas.addEventListener('webglcontextrestored', () => {
      console.warn('[WebGL] Context restored');
  });

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

  // --- Splash is now visible --- deferred work runs in parallel ---

  const deferredWork = Promise.all([
    SessionManager.init().catch(() => {
      console.warn('Backend not available — running in offline mode');
    }),
    Promise.all([
      document.fonts.load('bold 1em "Birch Std"'),
      document.fonts.load('bold 1em "Forte"'),
      document.fonts.load('600 1em "Poppins"'),
      document.fonts.load('700 1em "Poppins"'),
      document.fonts.load('400 1em "Inter"'),
      document.fonts.load('500 1em "Inter"'),
    ]),
  ]).then(() => {});

  ScreenManager.I.setDeferredWork(deferredWork);

  AudioManager.init();

  // Fire-and-forget preload of core SFX (non-blocking)
  AudioManager.preload(['uiSprites', 'reelSprites', 'winChime', 'baseMusic', 'bonusMusic', 'lowWin', 'h1Sfx', 'h2Sfx', 'wolfSfx', 'heartbeatSfx', 'wildPopSfx', 'chest', 'skull', 'bats', 'totalWin', 'normalWin', 'wildWin', 'winLoop', 'winLoopSuper', 'winLoopMega', 'bonusRoundAnnounce']);

  layoutManager.onCanvasChanged = (canvas) => {
    ScreenManager.I.onLayoutChanged(canvas);
    // Resize layers - will use correct viewport after getViewportSize is defined
  };

  const doResize = (width: number, height: number) => {
    layoutManager.resize(width, height);
    const canvas = layoutManager.getCanvas();
    layerManager.resize(width, height, canvas);
    guideManager.setViewportSize(width, height);
    ScreenManager.I.transitionMask.resize(width, height);
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

  // Coalesce resize events into a single RAF to avoid double layout recalculation
  let resizePending = false;
  const scheduleResize = () => {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => {
      resizePending = false;
      const vp = getViewportSize();
      if (vp.width > 0 && vp.height > 0) {
        doResize(vp.width, vp.height);
      }
    });
  };

  const resizeObserver = new ResizeObserver(scheduleResize);
  resizeObserver.observe(app.canvas);

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleResize);
  }

  // Initial resize
  const initialVp = getViewportSize();
  doResize(initialVp.width, initialVp.height);
  ScreenManager.I.onLayoutChanged(layoutManager.getCanvas());

  if (IS_DEBUG) {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') {
        layerManager.toggleDebugBorders();
      }
      if (e.key === 'l' || e.key === 'L') {
        layerManager.toggleLayoutDebug();
      }
    });

  }
}

main();

