import type { StartResponse, SymbolId } from '@shared/types';
import { gameSignals } from '../../Signals/game-signals';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const STORAGE_KEY = 'slot_jwt';

class SessionManagerClass {
    private _token = '';
    private _initialGrid: SymbolId[][] | null = null;

    async init(): Promise<void> {
        const oldToken = localStorage.getItem(STORAGE_KEY) ?? '';

        const res = await fetch(`${API_URL}/api/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: oldToken }),
        });

        if (!res.ok) {
            console.error('Failed to create session');
            return;
        }

        const data: StartResponse = await res.json();
        this._token = data.token;
        this._initialGrid = data.initialGrid;

        localStorage.setItem(STORAGE_KEY, data.token);
        gameSignals.balanceUpdated.emit({ value: data.balance });
    }

    getToken(): string {
        return this._token;
    }

    consumeInitialGrid(): SymbolId[][] | null {
        const grid = this._initialGrid;
        this._initialGrid = null;
        return grid;
    }

    clearSession(): void {
        this._token = '';
        localStorage.removeItem(STORAGE_KEY);
    }
}

export const SessionManager = new SessionManagerClass();
