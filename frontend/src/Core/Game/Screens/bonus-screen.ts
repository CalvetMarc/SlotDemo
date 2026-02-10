import { GameScreen } from "../../Abstractions/game-screen"

export class BonusScreen extends GameScreen{

    constructor(){
        super();
    }

    async load(): Promise<void> {
        // TODO: Load bonus screen assets and config
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