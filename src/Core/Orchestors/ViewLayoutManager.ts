import { View, ViewConfig } from "../Abstractions/View";
import { DesignCanvas } from "../Layout/DesignCanvas";
import { LayoutResolver } from "../Layout/LayoutConstraints";
import { Transform } from "../Utils/Transform";

/** Applies layout or transform to views based on configuration. */
export class ViewLayoutManager {
    /** Applies layout or transform to a view. Prefers layout over transform. */
    applyLayout(view: View, config: ViewConfig, canvas?: DesignCanvas): void {
        if (config.layout) {
            if (!canvas) {
                console.warn(
                    `ViewLayoutManager: Cannot apply layout to view "${config.id}" - canvas not provided. ` +
                    `Layout will be applied when canvas becomes available.`
                );
                return;
            }

            LayoutResolver.applyLayout(view, config.layout, canvas);
        }
        else if (config.transform) {
            const transform = new Transform(config.transform);
            transform.applyTo(view);
        }
    }

    /** Applies layout to multiple views. */
    applyLayoutToAll(views: View[], configs: ViewConfig[], canvas?: DesignCanvas): void {
        if (views.length !== configs.length) {
            throw new Error(
                `ViewLayoutManager: views and configs arrays must have the same length. ` +
                `Got ${views.length} views and ${configs.length} configs.`
            );
        }

        views.forEach((view, index) => {
            this.applyLayout(view, configs[index], canvas);
        });
    }

    /** Re-applies layout when canvas changes. Only works for layout system, not transforms. */
    updateLayout(view: View, config: ViewConfig, canvas: DesignCanvas): void {
        if (config.layout) {
            LayoutResolver.applyLayout(view, config.layout, canvas);
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
}
