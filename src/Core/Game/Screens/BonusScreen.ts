import { GameScreen } from "../../Abstractions/GameScreen"
import { BackgroundLayer } from "../Layers/BackgroundLayer";
import { UiLayer } from "../Layers/UiLayer";
import { GameLayer } from "../Layers/GameLayer";

export class BonusScreen extends GameScreen{

    constructor(backgroundLayer?: BackgroundLayer, uiLayer?: UiLayer, gameLayer?: GameLayer){
        super(backgroundLayer, uiLayer, gameLayer);
    }

    async onEnter(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    onUpdate(deltaMS: number): void {
        throw new Error("Method not implemented.");
    }
    
    async onExit(): Promise<void> {
        throw new Error("Method not implemented.");
    }

}