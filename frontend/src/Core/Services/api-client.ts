import { SessionManager } from '../Game/SlotMachine/session-manager';
import { gameSignals } from '../Signals/game-signals';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class SessionExpiredError extends Error {
    constructor() {
        super('Session expired');
        this.name = 'SessionExpiredError';
    }
}

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

class ApiClientClass {
    async post<T>(path: string, body?: unknown): Promise<T> {
        const res = await fetch(`${API_URL}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SessionManager.getToken()}`,
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        if (res.status === 401) {
            SessionManager.clearSession();
            gameSignals.sessionExpired.emit();
            throw new SessionExpiredError();
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Request failed' }));
            throw new ApiError(err.error ?? 'Request failed', res.status);
        }

        return res.json() as Promise<T>;
    }
}

export const ApiClient = new ApiClientClass();
