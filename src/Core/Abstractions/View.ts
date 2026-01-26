import { Container } from "pixi.js";
import { LayerId } from "./GameScreen";
import { TransformConfig } from "../Utils/Transform";

export interface ViewConfig {
    id: string;
    type: string;
    layer: LayerId;
    transform?: TransformConfig;
}

export type bundle = "boot" | "base" | "win" | "info" | "bonus"

export abstract class View extends Container {  
    public id!: string;

    abstract bundleNeeded(): bundle;    

    abstract appear(): void;
}