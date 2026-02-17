import { GameScreen, ScreenConfig } from '../../../Abstractions/game-screen';
import { BONUS_VIEW_REGISTRY } from './config/bonus-scene-loader';
import bonusConfig from './config/bonus-scene-config.json';
import { ChestView } from './views/chest-view';
import { BonusWinCounterView } from './views/bonus-win-counter-view';
import { GameModel } from '../../SlotMachine/game-model';
import { ScreenManager } from '../../../Managers/screen-manager';
import { ApiClient } from '../../../Services/api-client';
import type { BonusStartResponse, BonusPickResponse } from '@shared/types';

export class BonusScreen extends GameScreen {
    private _chests: ChestView[] = [];
    private _winCounter!: BonusWinCounterView;
    private _isPicking = false;

    constructor() {
        super();
    }

    async load(): Promise<void> {
        await this.loadConfig(bonusConfig as ScreenConfig, BONUS_VIEW_REGISTRY);
    }

    async onEnter(): Promise<void> {
        this.addViewsToLayers();

        // Gather chest views from the game layer
        this._chests = [];
        const gameViews = this.layerManager.getLayer('game').getViews();
        for (let i = 0; i < 5; i++) {
            const chest = gameViews[`bonus_chest_${i}`] as ChestView;
            chest.setup(i, (index) => this._onChestPicked(index));
            this._chests.push(chest);
        }

        const uiViews = this.layerManager.getLayer('ui').getViews();
        this._winCounter = uiViews['bonus_win_counter'] as BonusWinCounterView;
        this._winCounter.updateWin(0);

        // Tell the server to generate the chests
        await this._startBonus();
    }

    onUpdate(_deltaMS: number): void {
        // No per-frame logic needed
    }

    async onExit(): Promise<void> {
        this._chests = [];
    }

    private async _startBonus(): Promise<void> {
        try {
            await ApiClient.post<BonusStartResponse>('/api/bonus/start');
            // Chests are ready — player can pick
        } catch (err) {
            console.error('Bonus start error:', err);
        }
    }

    private async _onChestPicked(index: number): Promise<void> {
        if (this._isPicking) return;
        this._isPicking = true;

        try {
            const data = await ApiClient.post<BonusPickResponse>('/api/bonus/pick', { chestIndex: index });

            // Play chest open animation
            await this._chests[index].playOpen();

            if (data.prize !== null) {
                // Prize found — update counter
                this._winCounter.updateWin(data.totalBonusWin);
            }

            if (data.isGameOver) {
                // Disable remaining chests
                for (const chest of this._chests) {
                    chest.disable();
                }

                this._winCounter.showGameOver(data.totalBonusWin);

                // Update balance if provided
                if (data.balance !== undefined) {
                    GameModel.setBalance(data.balance);
                }

                // Wait then transition back to base
                setTimeout(() => {
                    ScreenManager.I.transitionMap.BONUS();
                }, 2500);
            }
        } catch (err) {
            console.error('Bonus pick error:', err);
        }

        this._isPicking = false;
    }
}
