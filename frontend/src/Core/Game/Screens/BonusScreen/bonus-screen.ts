import { GameScreen, ScreenConfig } from '../../../Abstractions/game-screen';
import { BONUS_VIEW_REGISTRY } from './config/bonus-scene-loader';
import bonusConfig from './config/bonus-scene-config.json';
import { ChestView } from './views/chest-view';
import { BonusWinCounterView } from './views/bonus-win-counter-view';
import { BonusHintView } from './views/bonus-hint-view';
import { GameModel } from '../../SlotMachine/game-model';
import { gameSignals } from '../../../Signals/game-signals';
import { ApiClient } from '../../../Services/api-client';
import type { BonusStartResponse } from '@shared/types';

export class BonusScreen extends GameScreen {
    private _chests: ChestView[] = [];
    private _winCounter!: BonusWinCounterView;
    private _hintView: BonusHintView | null = null;
    private _isPicking = false;
    private _sequence: (number | null)[] = [];
    private _pickIndex = 0;
    private _totalBonusWin = 0;
    private _pendingBalance = 0;

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

        this._hintView = gameViews['bonus_hint'] as BonusHintView ?? null;

        const uiViews = this.layerManager.getLayer('ui').getViews();
        this._winCounter = uiViews['bonus_win_counter'] as BonusWinCounterView;
        this._winCounter?.updateWin(0);
        this._totalBonusWin = 0;
        this._pickIndex = 0;
        this._pendingBalance = 0;

        // Server returns the predetermined sequence and credits balance atomically
        await this._startBonus();
    }

    onUpdate(_deltaMS: number): void {
        // No per-frame logic needed
    }

    async onExit(): Promise<void> {
        this._chests = [];
        this._sequence = [];
        this._pickIndex = 0;
        GameModel.setSpinning(false);
    }

    private async _startBonus(): Promise<void> {
        try {
            const data = await ApiClient.post<BonusStartResponse>('/api/bonus/start');
            this._sequence = data.sequence;
            this._totalBonusWin = data.totalBonusWin;
            this._pendingBalance = data.balance;
        } catch (err) {
            console.error('Bonus start error:', err);
        }
    }

    private async _onChestPicked(index: number): Promise<void> {
        if (this._isPicking) return;
        if (this._pickIndex >= this._sequence.length) return;
        this._isPicking = true;

        try {
            const prize = this._sequence[this._pickIndex];
            this._pickIndex++;

            // Play the open animation
            await this._chests[index].playOpen();

            if (prize !== null && prize !== undefined) {
                const multiplier = Math.round(prize / GameModel.betAmount);
                await this._chests[index].showPrize(multiplier);

                // Update running win display
                const runningWin = this._sequence
                    .slice(0, this._pickIndex)
                    .filter((v): v is number => v !== null)
                    .reduce((sum, v) => sum + v, 0);
                this._winCounter?.updateWin(runningWin);
            } else {
                await this._chests[index].showSkull();
            }

            // End if skull (null) or exhausted the sequence
            const isSkull = prize === null;
            if (isSkull || this._pickIndex >= this._sequence.length) {
                await this._endBonus();
            }
        } catch (err) {
            console.error('Bonus pick error:', err);
        }

        this._isPicking = false;
    }

    private async _endBonus(): Promise<void> {
        // Hide the hint text
        this._hintView?.hideHint();

        // Disable remaining chests
        for (const chest of this._chests) {
            chest.disable();
        }

        this._winCounter?.showGameOver(this._totalBonusWin);

        // Apply the server-credited balance and store bonus win for animation
        GameModel.setPendingBonusWin(this._totalBonusWin);
        GameModel.setBalance(this._pendingBalance);

        // Wait then transition back to base
        setTimeout(() => {
            gameSignals.requestBaseTransition.emit();
        }, 2500);
    }
}
