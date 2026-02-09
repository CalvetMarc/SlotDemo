import { View } from "../Abstractions/view";

type ViewCtor = new () => View;
export type ViewRegistry = Record<string, ViewCtor>;

export class ViewFactory {
    static create(type: string, registry: ViewRegistry): View {
        const ctor = registry[type];

        if (!ctor) {
            throw new Error(`Unknown View: ${type}`);
        }

        return new ctor();
    }
}
