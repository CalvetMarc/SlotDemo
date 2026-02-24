import { View, ViewConfig } from "../Abstractions/view";
import { DesignCanvas } from "../Layout/design-canvas";
import { LayoutResolver } from "../Layout/layout-constraints";

/** Type for view lookup function used with relativeTo positioning */
export type ViewLookupFn = (viewId: string) => { x: number; y: number; width: number; height: number } | null;

/** Applies layout to views based on configuration. */
export class ViewLayoutManager {
    /** Applies layout to a view. */
    applyLayout(view: View, config: ViewConfig, canvas?: DesignCanvas, viewLookup?: ViewLookupFn): void {
        if (!config.layout) return;

        if (!canvas) {
            console.warn(
                `ViewLayoutManager: Cannot apply layout to view "${config.id}" - canvas not provided. ` +
                `Layout will be applied when canvas becomes available.`
            );
            return;
        }

        LayoutResolver.applyLayout(view, config.layout, canvas, viewLookup);
        view.onLayoutApplied();
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

    /** Re-applies layout when canvas changes. */
    updateLayout(view: View, config: ViewConfig, canvas: DesignCanvas, viewLookup?: ViewLookupFn): void {
        if (config.layout) {
            LayoutResolver.applyLayout(view, config.layout, canvas, viewLookup);
            view.onLayoutApplied();
        }
    }

    /** Checks if view uses relativeTo positioning. */
    usesRelativeTo(config: ViewConfig, canvas: DesignCanvas): boolean {
        return config.layout !== undefined && LayoutResolver.usesRelativeTo(config.layout, canvas);
    }
}
