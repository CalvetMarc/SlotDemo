import type { SessionResponse, HeartbeatResponse, SymbolId } from '@shared/types';
import { gameSignals } from '../../Signals/game-signals';

const HEARTBEAT_INTERVAL_MS = 30_000;
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

class SessionManagerClass {
    private _token = '';
    private _heartbeatId: ReturnType<typeof setInterval> | null = null;
    private _initialGrid: SymbolId[][] | null = null;

    async init(): Promise<void> {
        const res = await fetch(`${API_URL}/api/session`, { method: 'POST' });

        if (!res.ok) {
            console.error('Failed to create session');
            return;
        }

        const data: SessionResponse = await res.json();
        this._token = data.token;
        this._initialGrid = data.initialGrid;

        gameSignals.balanceUpdated.emit({ value: data.balance });

        this._startHeartbeat();
    }

    getToken(): string {
        return this._token;
    }

    consumeInitialGrid(): SymbolId[][] | null {
        const grid = this._initialGrid;
        this._initialGrid = null;
        return grid;
    }

    dispose(): void {
        if (this._heartbeatId !== null) {
            clearInterval(this._heartbeatId);
            this._heartbeatId = null;
        }
    }

    private _startHeartbeat(): void {
        this._heartbeatId = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/api/heartbeat`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this._token}` },
                });

                if (res.ok) {
                    const data: HeartbeatResponse = await res.json();
                    this._token = data.token;
                }
            } catch {
                // Heartbeat failed silently — JWT will expire naturally
            }
        }, HEARTBEAT_INTERVAL_MS);
    }
}

export const SessionManager = new SessionManagerClass();
