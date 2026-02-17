import type { SpinResult, SpinResponse, SymbolId, LineWin } from '@shared/types';
import { SYMBOL_IDS, REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
import { gameSignals } from '../../Signals/game-signals';
import { SessionManager } from './session-manager';
import { GameModel } from './game-model';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface SpinResultWithWins extends SpinResult {
    winAmount: number;
    lineWins: LineWin[];
    wildCount: number;
    bonusTriggered: boolean;
}

export interface ISpinResultProvider {
    generateResult(betAmount: number): Promise<SpinResultWithWins>;
}

export class RemoteSpinResultProvider implements ISpinResultProvider {
    async generateResult(betAmount: number): Promise<SpinResultWithWins> {
        const res = await fetch(`${API_URL}/api/spin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SessionManager.getToken()}`,
            },
            body: JSON.stringify({ betAmount }),
        });

        if (res.status === 401) {
            SessionManager.clearSession();
            gameSignals.sessionExpired.emit();
            throw new Error('Session expired');
        }

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? 'Spin request failed');
        }

        const data: SpinResponse = await res.json();
        GameModel.setBalance(data.balance);

        return {
            grid: data.grid,
            winAmount: data.winAmount,
            lineWins: data.lineWins,
            wildCount: data.wildCount,
            bonusTriggered: data.bonusTriggered,
        };
    }
}

export class LocalSpinResultProvider implements ISpinResultProvider {
    async generateResult(_betAmount: number): Promise<SpinResultWithWins> {
        const grid: SymbolId[][] = [];
        for (let r = 0; r < REEL_COUNT; r++) {
            const column: SymbolId[] = [];
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                column.push(SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)]);
            }
            grid.push(column);
        }
        return { grid, winAmount: 0, lineWins: [], wildCount: 0, bonusTriggered: false };
    }
}
