import { Application, Assets } from 'pixi.js';
import { GameManager } from './Core/Game/GameManager';

async function main() {

  const app = new Application();
  await app.init({
    width: 1920,
    height: 1080,
    backgroundColor: 0x000000,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  document.body.appendChild(app.canvas);

  await Assets.init({
    manifest: 'assets_manifest.json'
  });  

  GameManager.I.init(app);
  await GameManager.I.start();
}

main();

