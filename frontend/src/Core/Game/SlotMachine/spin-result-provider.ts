import type { SpinResult, SpinResponse, SymbolId, LineWin } from '@shared/types';
import { SYMBOL_IDS, REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
import { ApiClient } from '../../Services/api-client';

export interface SpinResultWithWins extends SpinResult {
    winAmount: number;
    lineWins: LineWin[];
    wildCount: number;
    bonusTriggered: boolean;
    wildPay: number;
    /** Server-authoritative balance, applied when reels settle. */
    balance?: number;
}

export interface ISpinResultProvider {
    generateResult(betAmount: number): Promise<SpinResultWithWins>;
}

export class RemoteSpinResultProvider implements ISpinResultProvider {
    async generateResult(betAmount: number): Promise<SpinResultWithWins> {
        const data = await ApiClient.post<SpinResponse>('/api/spin', { betAmount });

        return {
            grid: data.grid,
            winAmount: data.winAmount,
            lineWins: data.lineWins,
            wildCount: data.wildCount,
            bonusTriggered: data.bonusTriggered,
            wildPay: data.wildPay ?? 0,
            balance: data.balance,
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
        return { grid, winAmount: 0, lineWins: [], wildCount: 0, bonusTriggered: false, wildPay: 0 };
    }
}
