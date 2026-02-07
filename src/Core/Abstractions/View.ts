import { Container } from "pixi.js";
import { LayoutConfig } from "../Layout/LayoutConstraints";

export interface ViewConfig {
    id: string;
    type: string;
    layer: string;  // Dynamic layer ID (e.g., 'background', 'game', 'ui', 'particles', etc.)
    layout?: LayoutConfig;
}

export type bundle = "boot" | "base" | "win" | "info" | "bonus"

export abstract class View extends Container {  
    public id!: string;

    abstract bundleNeeded(): bundle;    

    abstract appear(): void;
}