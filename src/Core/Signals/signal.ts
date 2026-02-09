export type SignalHandler<T> = (data: T) => void;

export class Signal<T = void> {
    private _handlers = new Set<SignalHandler<T>>();
    private _onceHandlers = new Set<SignalHandler<T>>();

    /** Subscribe to this signal. Returns an unsubscribe function. */
    connect(handler: SignalHandler<T>): () => void {
        this._handlers.add(handler);
        return () => this.disconnect(handler);
    }

    /** Subscribe for a single emission only. Returns an unsubscribe function. */
    once(handler: SignalHandler<T>): () => void {
        this._onceHandlers.add(handler);
        return () => this._onceHandlers.delete(handler);
    }

    /** Unsubscribe a specific handler. */
    disconnect(handler: SignalHandler<T>): void {
        this._handlers.delete(handler);
        this._onceHandlers.delete(handler);
    }

    /** Remove all subscribers. */
    disconnectAll(): void {
        this._handlers.clear();
        this._onceHandlers.clear();
    }

    /** Emit the signal, notifying all subscribers. */
    emit(data: T): void {
        for (const handler of this._handlers) {
            handler(data);
        }
        for (const handler of this._onceHandlers) {
            handler(data);
        }
        this._onceHandlers.clear();
    }

    /** Current subscriber count. */
    get count(): number {
        return this._handlers.size + this._onceHandlers.size;
    }
}
