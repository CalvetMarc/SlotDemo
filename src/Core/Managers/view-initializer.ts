import { View, ViewConfig } from "../Abstractions/view";

/** Initializes views by setting IDs and calling appear(). */
export class ViewInitializer {
    /** Initializes a single view with its configuration. */
    initialize(view: View, config: ViewConfig): void {
        view.id = config.id;
        view.appear();
    }

    /** Initializes multiple views with their configurations. */
    initializeAll(views: View[], configs: ViewConfig[]): void {
        if (views.length !== configs.length) {
            throw new Error(
                `ViewInitializer: views and configs arrays must have the same length. ` +
                `Got ${views.length} views and ${configs.length} configs.`
            );
        }

        views.forEach((view, index) => {
            this.initialize(view, configs[index]);
        });
    }

    /** Checks if a view has been initialized. */
    isInitialized(view: View): boolean {
        return view.isInitialized;
    }

    /** Initializes all views with error handling. Returns array of errors if any. */
    initializeAllSafe(views: View[], configs: ViewConfig[]): Error[] {
        const errors: Error[] = [];

        views.forEach((view, index) => {
            try {
                this.initialize(view, configs[index]);
            } catch (error) {
                errors.push(
                    new Error(
                        `Failed to initialize view "${configs[index].id}": ${error}`
                    )
                );
            }
        });

        return errors;
    }
}
