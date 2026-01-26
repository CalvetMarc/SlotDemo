import { GameScreen } from "../../../Abstractions/GameScreen"
import { LayerId } from "../../../Abstractions/GameScreen";
import { Layer } from "../../../Abstractions/Layer";

export class BaseScreen extends GameScreen{   

    constructor(layers?: Partial<Record<LayerId, Layer>>){
        super(layers);
    }

    load(): void {
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