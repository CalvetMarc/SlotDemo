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
    private _id?: string;

    get id(): string {
        if (!this._id) throw new Error('View.id accessed before initialization');
        return this._id;
    }

    set id(value: string) { this._id = value; }

    get isInitialized(): boolean { return !!this._id; }

    abstract bundleNeeded(): bundle;    

    abstract appear(): void;
}