import { Container, DestroyOptions } from "pixi.js";
import { LayoutConfig } from "../Layout/layout-constraints";

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

    protected dispose(): void { /* override to clean up resources */ }

    resetLayoutCache(): void {
        const target = this as unknown as { _cachedIntrinsicSize?: unknown };
        target._cachedIntrinsicSize = undefined;
    }

    destroy(options?: DestroyOptions): void {
        this.dispose();
        super.destroy(options);
    }
}