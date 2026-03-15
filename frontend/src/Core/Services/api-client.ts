import { SessionManager } from '../Game/SlotMachine/session-manager';
import { gameSignals } from '../Signals/game-signals';
import { ConnectionIndicator } from '../Debug/connection-indicator';

const API_URL = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3000`;

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
        let res: Response;
        try {
            res = await fetch(`${API_URL}${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SessionManager.getToken()}`,
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
        } catch (err) {
            ConnectionIndicator.set('offline');
            throw err;
        }

        if (res.status === 401) {
            SessionManager.clearSession();
            gameSignals.sessionExpired.emit();
            throw new SessionExpiredError();
        }

        if (!res.ok) {
            ConnectionIndicator.set('offline');
            const err = await res.json().catch(() => ({ error: 'Request failed' }));
            throw new ApiError(err.error ?? 'Request failed', res.status);
        }

        ConnectionIndicator.set('online');
        return res.json() as Promise<T>;
    }
}

export const ApiClient = new ApiClientClass();
