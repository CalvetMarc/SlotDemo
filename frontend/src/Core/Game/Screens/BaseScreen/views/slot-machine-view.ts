import { Sprite, Container, Graphics, Ticker } from 'pixi.js';
import { View, bundle } from '../../../../Abstractions/view';
import { Reel } from '../../../SlotMachine/reel';
import {
    RemoteSpinResultProvider,
    SpinResultWithWins,
} from '../../../SlotMachine/spin-result-provider';
import { gameSignals } from '../../../../Signals/game-signals';
import type { SymbolId, BuyBonusResponse } from '@shared/types';
import { SYMBOL_IDS, REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
import { ApiClient } from '../../../../Services/api-client';
import { CELL_SIZE, GRID_WIDTH, GRID_HEIGHT, REEL_STOP_INTERVAL } from '../../../SlotMachine/slot-config';
import { SessionManager } from '../../../SlotMachine/session-manager';
import { createDebugKeyHandler } from '../../../SlotMachine/debug-spins';
import { WinPresentationController } from '../../../SlotMachine/win-presentation-controller';
import { TensionController } from '../../../SlotMachine/tension-controller';
import { SpinController } from '../../../SlotMachine/spin-controller';
import { TweenManager } from '../../../../Animation/tween';
import { GameModel } from '../../../SlotMachine/game-model';
import { IS_DEBUG } from '../../../../Utils/env';

export class SlotMachineView extends View {
    private _frameBackground!: Sprite;
    private _frame!: Sprite;
    private _reelContainer!: Container;
    private _reelMask!: Graphics;
    private _reels: Reel[] = [];
    private _winPresentationTimeout?: ReturnType<typeof setTimeout>;
    private _unsubscribeSpin?: () => void;
    private _unsubscribeBuyBonus?: () => void;
    private _unsubSpinningForAutoplay?: () => void;
    private _autoSpinTimeout?: ReturnType<typeof setTimeout>;
    private _debugCleanup?: () => void;
    private _skipHandler?: () => void;
    private _keydownHandler?: (e: KeyboardEvent) => void;

    private _spinController!: SpinController;
    private _winController!: WinPresentationController;
    private _tensionController!: TensionController;

    bundleNeeded(): bundle {
        return 'base';
    }

    appear(): void {
        // Frame background (behind reels)
        this._frameBackground = Sprite.from('frame_background');
        this._frameBackground.anchor.set(0.5);
        this.addChild(this._frameBackground);

        // Reel container (centered on frame background)
        this._reelContainer = new Container();
        this._reelContainer.x = -GRID_WIDTH * 0.5;
        this._reelContainer.y = -GRID_HEIGHT * 0.5;
        this.addChild(this._reelContainer);

        // Mask to clip symbols to the grid area (expanded to match frame_back)
        const maskPadX = (1736 - GRID_WIDTH) / 2;
        const maskPadY = (1049 - GRID_HEIGHT) / 2;
        this._reelMask = new Graphics();
        this._reelMask.rect(-maskPadX, -maskPadY, GRID_WIDTH + maskPadX * 2, GRID_HEIGHT + maskPadY * 2);
        this._reelMask.fill({ color: 0xffffff });
        this._reelContainer.addChild(this._reelMask);
        this._reelContainer.mask = this._reelMask;

        // Create reels
        for (let i = 0; i < REEL_COUNT; i++) {
            const reel = new Reel(i);
            reel.x = i * CELL_SIZE;
            this._reelContainer.addChild(reel);
            this._reels.push(reel);
        }

        // ── Controllers ──────────────────────────────────────────────
        this._spinController = new SpinController({
            reels: this._reels,
            resultProvider: new RemoteSpinResultProvider(),
        });
        this._spinController.onSpinStarting = () => {
            this._clearAll();
            for (const reel of this._reels) reel.setDim(false);
        };
        this._spinController.onAllReelsStopped = (result, isTension) => {
            this._onAllReelsStopped(result, isTension);
        };

        this._winController = new WinPresentationController({
            reels: this._reels,
            reelContainer: this._reelContainer,
        });
        this._winController.onBonusDismissed = () => {
            this._clearAll();
            gameSignals.requestBonusTransition.emit();
        };

        this._tensionController = new TensionController({ reels: this._reels });
        this._tensionController.onTensionResolved = (result, shouldCelebrate) => {
            if (shouldCelebrate) {
                this._winController.show(result);
            }
        };

        // Set initial symbols from backend session
        this._setInitialSymbols();

        // Frame overlay (on top of reels)
        this._frame = Sprite.from('frame');
        this._frame.anchor.set(0.5);
        this.addChild(this._frame);

        this._winController.onLinePresented = (info) => {
            gameSignals.lineWinPresented.emit(info);
        };
        this._winController.onPresentationCleared = () => {
            gameSignals.winPresentationCleared.emit();
        };

        // ── Signals ──────────────────────────────────────────────────
        this._unsubscribeSpin = gameSignals.spinPressed.connect(() => {
            GameModel.setLastResult(null);
            this._spinController.startSpin().catch(err => console.error('Spin failed:', err));
        });

        this._unsubscribeBuyBonus = gameSignals.buyBonusConfirmed.connect(({ tier }) => {
            this._handleBuyBonus(tier).catch(err => console.error('Buy bonus failed:', err));
        });

        if (IS_DEBUG) {
            this._debugCleanup = createDebugKeyHandler({
                getIsSpinning: () => this._spinController.isSpinning,
                getBetAmount: () => this._spinController.getBetAmount(),
                triggerSpin: async (forced) => {
                    // Debug bonus spins bypass the server spin, so set up bonus on server via buy
                    if (forced.bonusTriggered) {
                        try {
                            const bet = this._spinController.getBetAmount();
                            await ApiClient.post('/api/bonus/buy', { betAmount: bet, tier: 1 });
                        } catch { /* balance may be insufficient — bonus screen will handle */ }
                    }
                    this._spinController.setForcedResult(forced);
                    this._spinController.startSpin().catch(err => console.error('[DebugSpin] failed:', err));
                },
            }).attach();
        }

        this._skipHandler = () => this._spinController.skipSpin();
        window.addEventListener('pointerdown', this._skipHandler);

        // Space bar triggers spin
        this._keydownHandler = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                gameSignals.spinPressed.emit();
            }
        };
        window.addEventListener('keydown', this._keydownHandler);

        // Autoplay loop: when a spin ends and remaining > 0, fire next spin
        this._unsubSpinningForAutoplay = GameModel.spinningChanged.connect(({ isSpinning }) => {
            if (isSpinning || GameModel.autoSpinRemaining <= 0) return;

            const lastResult = GameModel.lastResult;

            // Pause autoplay on bonus — keep remaining count, user resumes with play
            if (lastResult?.bonusTriggered) {
                return;
            }

            // Decrement remaining
            const next = GameModel.autoSpinRemaining - 1;
            GameModel.setAutoSpinRemaining(next);

            // If still remaining, fire next spin after short delay
            if (next > 0) {
                this._autoSpinTimeout = setTimeout(() => {
                    gameSignals.spinPressed.emit();
                }, 500);
            }
        });

        Ticker.shared.add(this._onTick, this);
    }

    protected dispose(): void {
        Ticker.shared.remove(this._onTick, this);
        this._unsubscribeSpin?.();
        this._unsubscribeBuyBonus?.();
        this._unsubSpinningForAutoplay?.();
        if (this._autoSpinTimeout) {
            clearTimeout(this._autoSpinTimeout);
            this._autoSpinTimeout = undefined;
        }
        this._debugCleanup?.();
        if (this._skipHandler) {
            window.removeEventListener('pointerdown', this._skipHandler);
            this._skipHandler = undefined;
        }
        if (this._keydownHandler) {
            window.removeEventListener('keydown', this._keydownHandler);
            this._keydownHandler = undefined;
        }
        this._clearAll();
        this._spinController.dispose();
        this._winController.dispose();
        this._tensionController.dispose();
    }

    // ── Tick ──────────────────────────────────────────────────────

    private _onTick(ticker: Ticker): void {
        const dt = ticker.deltaTime;
        for (const reel of this._reels) {
            reel.update(dt);
        }
        const deltaMs = dt * 16.67;
        TweenManager.update(deltaMs);
        for (const reel of this._reels) {
            reel.updateWildPop(deltaMs);
        }
        this._winController.update(deltaMs);
    }

    // ── Junction ─────────────────────────────────────────────────

    private _onAllReelsStopped(result: SpinResultWithWins, isTension: boolean): void {
        GameModel.setLastResult(result);
        const shouldCelebrate = result.winAmount > 0 || result.bonusTriggered;

        if (isTension) {
            this._tensionController.playTensionSequence(result, shouldCelebrate);
        } else {
            this._tensionController.playNonTensionResolve();
        }

        this._spinController.clearTimeouts();

        if (result.bonusTriggered) {
            this._winController.setupBonus(result);
        }

        if (shouldCelebrate && !isTension) {
            const hasWilds = this._reels.some(r => r.hasWildPops);
            const WIN_REVEAL_PAUSE = 100;
            const wildAnimDelay = hasWilds ? REEL_STOP_INTERVAL * 2 + 300 : 0;
            const delay = wildAnimDelay + WIN_REVEAL_PAUSE;

            this._winPresentationTimeout = setTimeout(() => {
                this._winController.show(result);
            }, delay);
        }

        if (!result.bonusTriggered) {
            GameModel.setSpinning(false);
        }
    }

    // ── Buy Bonus ─────────────────────────────────────────────────

    private async _handleBuyBonus(tier: number): Promise<void> {
        if (GameModel.isSpinning) return;
        GameModel.setSpinning(true);

        try {
            const data = await ApiClient.post<BuyBonusResponse>('/api/bonus/buy', {
                betAmount: GameModel.betAmount,
                tier,
            });

            GameModel.setBalance(data.balance);

            const result: SpinResultWithWins = {
                grid: data.grid,
                winAmount: data.winAmount,
                lineWins: data.lineWins,
                wildCount: data.wildCount,
                bonusTriggered: data.bonusTriggered,
                wildPay: data.wildPay,
            };

            GameModel.setLastResult(null);
            GameModel.setSpinning(false);
            this._spinController.setForcedResult(result);
            await this._spinController.startSpin();
        } catch (err) {
            GameModel.setSpinning(false);
            console.error('Buy bonus request failed:', err);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────

    private _clearAll(): void {
        if (this._winPresentationTimeout) {
            clearTimeout(this._winPresentationTimeout);
            this._winPresentationTimeout = undefined;
        }
        this._tensionController.clearTimeouts();
        for (const reel of this._reels) reel.clearWildPop();
        this._winController.clear();
    }

    private _setInitialSymbols(): void {
        const grid = SessionManager.consumeInitialGrid();
        if (grid) {
            for (let i = 0; i < REEL_COUNT; i++) {
                this._reels[i].setSymbols(grid[i]);
            }
        } else {
            for (let i = 0; i < REEL_COUNT; i++) {
                const symbols: SymbolId[] = [];
                for (let row = 0; row < VISIBLE_ROWS; row++) {
                    symbols.push(SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)]);
                }
                this._reels[i].setSymbols(symbols);
            }
        }
    }
}
