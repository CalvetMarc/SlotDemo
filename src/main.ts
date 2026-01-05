import { Application, Graphics } from 'pixi.js';

const app = new Application();

await app.init({
  width: 800,
  height: 600,
  backgroundColor: 0x1099bb,
});

document.body.appendChild(app.canvas);

const graphics = new Graphics();
graphics.fill(0xff0000);
graphics.circle(400, 300, 50);
graphics.fill();

app.stage.addChild(graphics);
