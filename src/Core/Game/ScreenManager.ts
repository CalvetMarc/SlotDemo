import { Application, Container, Size } from 'pixi.js';
import { Ticker } from 'pixi.js';

import { SingletonBase } from '../Abstractions/SingletonBase';
import { GameScreen } from '../Abstractions/GameScreen';
import { SplashScreen } from './Screens/SplashScreen';

import { ScreenTypes } from '../Utils/utils';
import { BaseScreen } from './Screens/BaseScreen';
import { BonusScreen } from './Screens/BonusScreen';

export class ScreenManager extends SingletonBase {
  private app!: Application;
  private currentScreen?: GameScreen;
  private sceneMap: Record<ScreenTypes, GameScreen | null> = {
    "SPLASH": null,
    "BASE": null,
    "BONUS": null
  }

  public transitionMap: Record<ScreenTypes, Promise<void>> = {
    SPLASH: this.changeScene("SPLASH", "BASE", true),
    BASE: this.changeScene("BASE", "BONUS", false),
    BONUS: this.changeScene("BONUS", "BASE", true)
  }

  protected constructor() {
    super();
  }

  public static get I(): ScreenManager {
    return super.getInstance<ScreenManager>();
  }

  public init(app: Application): void {
    this.app = app;   
    this.app.ticker.add(this.update, this);
  }

  public async start(): Promise<void> {
    const splash = new SplashScreen();
  }

  private update(ticker: Ticker): void {
    const dtMs = ticker.deltaMS;
    this.currentScreen?.onUpdate(dtMs);
  }

  private async changeScene(transitionFrom: ScreenTypes, transitionTo: ScreenTypes, destroyCurrent: boolean): Promise<void>{
    if(this.currentScreen){
        await this.currentScreen.onExit();            
        destroyCurrent ? this.currentScreen.destroy({children: true}) : this.sceneMap[transitionFrom] = this.currentScreen;            
    }

    this.currentScreen = this.sceneMap[transitionTo] ?? this.screenFactory(transitionTo);
    await this.currentScreen.onEnter();   
  }

  private screenFactory(screenKey: ScreenTypes): GameScreen{
    switch(screenKey){
        case "SPLASH":
            return new SplashScreen();
            break;
        case "BASE":
            return new BaseScreen();
            break;
        case "BONUS":
            return new BonusScreen();
            break;
    }
  }

/* 
  private checkDisplay(){
    const rawW = window.innerWidth;
    const rawH = window.innerHeight;

    // 🔹 flags separats
    this.layoutType = rawW < 768 ? "mobile" : "desktop";
    const aspect = rawH / rawW;
    const shouldRotate = aspect > 1.3;

    // dimensions virtuals per calcular escala
    const screenW = shouldRotate ? rawH : rawW;
    const screenH = shouldRotate ? rawW : rawH;

    // 🔥 CONTAIN GLOBAL
    const scale = Math.min(
      screenW / this.gameSize.width,
      screenH / this.gameSize.height
    );

    // 🔹 aplicar escala
    this.rootLayer.scale.set(scale);

    // reset
    this.rootLayer.rotation = 0;

    // 🔹 centrat base
    let posX = (rawW - this.gameSize.width * scale) * 0.5;
    let posY = (rawH - this.gameSize.height * scale) * 0.5;

    // 🔹 rotació només si cal
    if (shouldRotate) {
      this.rootLayer.rotation = Math.PI / 2;
      const rotatedW = this.gameSize.height * scale;
      const rotatedH = this.gameSize.width * scale;

      posX = rawW - (rawW - rotatedW) * 0.5;
      posY = (rawH - rotatedH) * 0.5;

    }

    this.rootLayer.position.set(posX, posY);   
  } */

  /* // 🔥 RESIZE GLOBAL (CLAU)
  private onResize = () => {
    this.checkDisplay();
  }; */


}
