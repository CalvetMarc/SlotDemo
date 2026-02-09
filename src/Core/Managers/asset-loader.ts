import { Assets } from "pixi.js";
import { View } from "../Abstractions/view";

/** Loads asset bundles for views. */
export class AssetLoader {
    /** Loads the required asset bundle for a single view if not cached. */
    async loadForView(view: View): Promise<void> {
        const bundle = view.bundleNeeded();

        if (!Assets.cache.has(bundle)) {
            await Assets.loadBundle(bundle);
        }
    }

    /** Loads assets for multiple views in parallel. */
    async loadForViews(views: View[]): Promise<void> {
        await Promise.all(
            views.map(view => this.loadForView(view))
        );
    }

    /** Checks if a bundle is already loaded in cache. */
    isBundleLoaded(bundleName: string): boolean {
        return Assets.cache.has(bundleName);
    }

    /** Preloads bundles without requiring view instances. */
    async preloadBundles(bundleNames: string[]): Promise<void> {
        await Promise.all(
            bundleNames.map(bundle => Assets.loadBundle(bundle))
        );
    }
}
