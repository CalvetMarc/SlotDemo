import { Sprite, Container, Graphics, Ticker, Text, TextStyle } from 'pixi.js';
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

export class SlotMachineView extends View {
    private _frameBackground!: Sprite;
    private _frame!: Sprite;
    private _reelContainer!: Container;
    private _reelMask!: Graphics;
    private _reels: Reel[] = [];
    private _debugWinText!: Text;
    private _debugWinTimeout?: ReturnType<typeof setTimeout>;
    private _winPresentationTimeout?: ReturnType<typeof setTimeout>;
    private _unsubscribeSpin?: () => void;
    private _unsubscribeBuyBonus?: () => void;
    private _debugCleanup?: () => void;

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
            this._debugWinText.visible = false;
            if (this._debugWinTimeout) {
                clearTimeout(this._debugWinTimeout);
                this._debugWinTimeout = undefined;
            }
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
            this._emitResultSignals(result);
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

        // Debug win text
        this._debugWinText = new Text({
            text: '',
            style: new TextStyle({
                fontFamily: 'Arial',
                fontSize: 48,
                fontWeight: 'bold',
                fill: 0xffd700,
                stroke: { color: 0x000000, width: 5 },
                align: 'center',
            }),
        });
        this._debugWinText.anchor.set(0.5);
        this._debugWinText.y = GRID_HEIGHT * 0.5 + 60;
        this._debugWinText.visible = false;
        this.addChild(this._debugWinText);

        // ── Signals ──────────────────────────────────────────────────
        this._unsubscribeSpin = gameSignals.spinPressed.connect(() => {
            GameModel.setLastResult(null);
            this._spinController.startSpin().catch(err => console.error('Spin failed:', err));
        });

        this._unsubscribeBuyBonus = gameSignals.buyBonusConfirmed.connect(({ tier }) => {
            this._handleBuyBonus(tier).catch(err => console.error('Buy bonus failed:', err));
        });

        this._debugCleanup = createDebugKeyHandler({
            getIsSpinning: () => this._spinController.isSpinning,
            getBetAmount: () => this._spinController.getBetAmount(),
            triggerSpin: (forced) => {
                this._spinController.setForcedResult(forced);
                this._spinController.startSpin().catch(err => console.error('[DebugSpin] failed:', err));
            },
        }).attach();

        Ticker.shared.add(this._onTick, this);
    }

    protected dispose(): void {
        Ticker.shared.remove(this._onTick, this);
        this._unsubscribeSpin?.();
        this._unsubscribeBuyBonus?.();
        this._debugCleanup?.();
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
            if (!isTension) {
                const wildPayMsg = result.wildPay > 0 ? ` +${result.wildPay.toFixed(2)}€ wild pay` : '';
                this._showDebugWin(`BONUS! ${result.wildCount} wilds${wildPayMsg}`);
            }
        }

        if (shouldCelebrate && !isTension) {
            const hasWilds = this._reels.some(r => r.hasWildPops);
            const delay = hasWilds ? REEL_STOP_INTERVAL * 2 + 300 : 0;

            if (delay > 0) {
                this._winPresentationTimeout = setTimeout(() => {
                    this._emitResultSignals(result);
                    this._winController.show(result);
                }, delay);
            } else {
                this._emitResultSignals(result);
                this._winController.show(result);
            }
        }

        if (!result.bonusTriggered) {
            GameModel.setSpinning(false);
        }
    }

    // ── Buy Bonus ─────────────────────────────────────────────────

    private async _handleBuyBonus(tier: number): Promise<void> {
        if (GameModel.isSpinning) return;

        try {
            const data = await ApiClient.post<BuyBonusResponse>('/api/bonus/buy', {
                betAmount: GameModel.betAmount,
                tier,
            });

            GameModel.setBalance(data.balance);
            const wildPayMsg = data.wildPay > 0 ? ` +${data.wildPay.toFixed(2)}€ wild pay` : '';
            this._showDebugWin(`BUY BONUS T${data.tier}! ${data.wildCount} wilds${wildPayMsg}`);
            gameSignals.requestBonusTransition.emit();
        } catch (err) {
            console.error('Buy bonus request failed:', err);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────

    private _emitResultSignals(result: SpinResultWithWins): void {
        if (result.winAmount > 0) {
            const lineWin = result.winAmount - result.wildPay;
            if (lineWin > 0 && result.wildPay > 0) {
                this._showDebugWin(`WIN ${result.winAmount.toFixed(2)}€ (wild pay +${result.wildPay.toFixed(2)})`);
            } else if (result.wildPay > 0) {
                this._showDebugWin(`WILD PAY ${result.wildPay.toFixed(2)}€`);
            } else {
                this._showDebugWin(`WIN ${result.winAmount.toFixed(2)}€`);
            }
        } else if (result.bonusTriggered) {
            this._showDebugWin(`BONUS! ${result.wildCount} wilds`);
        }
    }

    private _showDebugWin(message: string): void {
        this._debugWinText.text = message;
        this._debugWinText.visible = true;
        if (this._debugWinTimeout) {
            clearTimeout(this._debugWinTimeout);
            this._debugWinTimeout = undefined;
        }
    }

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
