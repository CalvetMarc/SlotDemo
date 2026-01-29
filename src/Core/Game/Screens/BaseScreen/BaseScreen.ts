import { GameScreen } from "../../../Abstractions/GameScreen"

export class BaseScreen extends GameScreen{

    constructor(){
        super();
    }

    async load(): Promise<void> {
        throw new Error("Method not implemented.");
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