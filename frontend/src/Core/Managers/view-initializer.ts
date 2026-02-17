import { View, ViewConfig } from "../Abstractions/view";

/** Initializes views by setting IDs and calling appear(). */
export class ViewInitializer {
    /** Initializes a single view with its configuration. */
    initialize(view: View, config: ViewConfig): void {
        view.id = config.id;
        view.appear();
    }
}
