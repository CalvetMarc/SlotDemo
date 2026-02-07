import { View, ViewConfig } from "../Abstractions/View";
import { DesignCanvas } from "../Layout/DesignCanvas";
import { LayoutResolver } from "../Layout/LayoutConstraints";
import { Transform } from "../Utils/Transform";

/** Type for view lookup function used with relativeTo positioning */
export type ViewLookupFn = (viewId: string) => { x: number; y: number; width: number; height: number } | null;

/** Applies layout or transform to views based on configuration. */
export class ViewLayoutManager {
    /** Applies layout or transform to a view. Prefers layout over transform. */
    applyLayout(view: View, config: ViewConfig, canvas?: DesignCanvas, viewLookup?: ViewLookupFn): void {
        if (config.layout) {
            if (!canvas) {
                console.warn(
                    `ViewLayoutManager: Cannot apply layout to view "${config.id}" - canvas not provided. ` +
                    `Layout will be applied when canvas becomes available.`
                );
                return;
            }

            LayoutResolver.applyLayout(view, config.layout, canvas, viewLookup);
        }
        else if (config.transform) {
            const transform = new Transform(config.transform);
            transform.applyTo(view);
        }
    }

    /** Applies layout to multiple views. */
    applyLayoutToAll(views: View[], configs: ViewConfig[], canvas?: DesignCanvas, viewLookup?: ViewLookupFn): void {
        if (views.length !== configs.length) {
            throw new Error(
                `ViewLayoutManager: views and configs arrays must have the same length. ` +
                `Got ${views.length} views and ${configs.length} configs.`
            );
        }

        views.forEach((view, index) => {
            this.applyLayout(view, configs[index], canvas, viewLookup);
        });
    }

    /** Re-applies layout when canvas changes. Only works for layout system, not transforms. */
    updateLayout(view: View, config: ViewConfig, canvas: DesignCanvas, viewLookup?: ViewLookupFn): void {
        if (config.layout) {
            LayoutResolver.applyLayout(view, config.layout, canvas, viewLookup);
        }
    }

    /** Checks if view uses layout system. */
    usesLayoutSystem(config: ViewConfig): boolean {
        return config.layout !== undefined;
    }

    /** Checks if view uses legacy transform system. */
    usesTransformSystem(config: ViewConfig): boolean {
        return config.transform !== undefined;
    }

    /** Checks if view uses relativeTo positioning. */
    usesRelativeTo(config: ViewConfig, canvas: DesignCanvas): boolean {
        return config.layout !== undefined && LayoutResolver.usesRelativeTo(config.layout, canvas);
    }
}
