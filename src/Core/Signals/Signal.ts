export type SignalHandler<T> = (data: T) => void;

export class Signal<T = void> {
    private handlers = new Set<SignalHandler<T>>();
    private onceHandlers = new Set<SignalHandler<T>>();

    /** Subscribe to this signal. Returns an unsubscribe function. */
    connect(handler: SignalHandler<T>): () => void {
        this.handlers.add(handler);
        return () => this.disconnect(handler);
    }

    /** Subscribe for a single emission only. Returns an unsubscribe function. */
    once(handler: SignalHandler<T>): () => void {
        this.onceHandlers.add(handler);
        return () => this.onceHandlers.delete(handler);
    }

    /** Unsubscribe a specific handler. */
    disconnect(handler: SignalHandler<T>): void {
        this.handlers.delete(handler);
        this.onceHandlers.delete(handler);
    }

    /** Remove all subscribers. */
    disconnectAll(): void {
        this.handlers.clear();
        this.onceHandlers.clear();
    }

    /** Emit the signal, notifying all subscribers. */
    emit(data: T): void {
        for (const handler of this.handlers) {
            handler(data);
        }
        for (const handler of this.onceHandlers) {
            handler(data);
        }
        this.onceHandlers.clear();
    }

    /** Current subscriber count. */
    get count(): number {
        return this.handlers.size + this.onceHandlers.size;
    }
}
