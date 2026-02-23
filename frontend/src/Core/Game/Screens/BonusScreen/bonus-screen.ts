import { GameScreen, ScreenConfig } from '../../../Abstractions/game-screen';
import { BONUS_VIEW_REGISTRY } from './config/bonus-scene-loader';
import bonusConfig from './config/bonus-scene-config.json';
import { ChestView } from './views/chest-view';
import { BonusWinCounterView } from './views/bonus-win-counter-view';
import { GameModel } from '../../SlotMachine/game-model';
import { gameSignals } from '../../../Signals/game-signals';
import { ApiClient } from '../../../Services/api-client';
import type { BonusStartResponse, BonusCollectResponse } from '@shared/types';

export class BonusScreen extends GameScreen {
    private _chests: ChestView[] = [];
    private _winCounter!: BonusWinCounterView;
    private _isPicking = false;
    private _chestPrizes: (number | null)[] = [];
    private _totalBonusWin = 0;

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
        this._winCounter?.updateWin(0);
        this._totalBonusWin = 0;

        // Server returns all chest prizes at once
        await this._startBonus();
    }

    onUpdate(_deltaMS: number): void {
        // No per-frame logic needed
    }

    async onExit(): Promise<void> {
        this._chests = [];
        this._chestPrizes = [];
        GameModel.setSpinning(false);
    }

    private async _startBonus(): Promise<void> {
        try {
            const data = await ApiClient.post<BonusStartResponse>('/api/bonus/start');
            this._chestPrizes = data.chests;
        } catch (err) {
            console.error('Bonus start error:', err);
        }
    }

    private async _onChestPicked(index: number): Promise<void> {
        if (this._isPicking) return;
        this._isPicking = true;

        try {
            const prize = this._chestPrizes[index];

            // Play the open animation (no API call needed)
            await this._chests[index].playOpen();

            if (prize !== null && prize !== undefined) {
                // Show the prize multiplier rising out of the chest
                const multiplier = Math.round(prize / GameModel.betAmount);
                await this._chests[index].showPrize(multiplier);

                this._totalBonusWin += prize;
                this._winCounter?.updateWin(this._totalBonusWin);
            } else {
                // Show skull (no need to await — game ends immediately after)
                this._chests[index].showSkull();
            }

            // Game over if skull (null) or all chests opened
            const isSkull = prize === null;
            const allOpened = this._chests.every((_, i) => this._chests[i].isOpened);
            if (isSkull || allOpened) {
                await this._endBonus();
            }
        } catch (err) {
            console.error('Bonus pick error:', err);
        }

        this._isPicking = false;
    }

    private async _endBonus(): Promise<void> {
        // Disable remaining chests
        for (const chest of this._chests) {
            chest.disable();
        }

        this._winCounter?.showGameOver(this._totalBonusWin);

        // Collect winnings from the server
        try {
            const data = await ApiClient.post<BonusCollectResponse>(
                '/api/bonus/collect',
                { totalBonusWin: this._totalBonusWin },
            );
            GameModel.setBalance(data.balance);
        } catch (err) {
            console.error('Bonus collect error:', err);
        }

        // Wait then transition back to base
        setTimeout(() => {
            gameSignals.requestBaseTransition.emit();
        }, 2500);
    }
}
