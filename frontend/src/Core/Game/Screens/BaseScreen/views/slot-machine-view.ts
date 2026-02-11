import { Sprite, Container, Graphics, Ticker, Text, TextStyle } from 'pixi.js';
import { View, bundle } from '../../../../Abstractions/view';
import { Reel } from '../../../SlotMachine/reel';
import {
    RemoteSpinResultProvider,
    SpinResultWithWins,
} from '../../../SlotMachine/spin-result-provider';
import { gameSignals } from '../../../../Signals/game-signals';
import type { SymbolId } from '@shared/types';
import { SYMBOL_IDS, REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
import {
    CELL_SIZE, GRID_WIDTH, GRID_HEIGHT,
    SPIN_MIN_DURATION, REEL_START_INTERVAL, REEL_STOP_INTERVAL,
} from '../../../SlotMachine/slot-config';
import { ScreenManager } from '../../../../Managers/screen-manager';
import { SessionManager } from '../../../SlotMachine/session-manager';

export class SlotMachineView extends View {
    private _frameBackground!: Sprite;
    private _frame!: Sprite;
    private _reelContainer!: Container;
    private _reelMask!: Graphics;
    private _reels: Reel[] = [];
    private _resultProvider!: RemoteSpinResultProvider;
    private _isSpinning = false;
    private _currentBetAmount = 2;
    private _unsubscribeSpin?: () => void;
    private _unsubscribeBet?: () => void;
    private _stopTimeouts: ReturnType<typeof setTimeout>[] = [];
    private _debugWinText!: Text;
    private _debugWinTimeout?: ReturnType<typeof setTimeout>;

    bundleNeeded(): bundle {
        return 'base';
    }

    appear(): void {
        // Always use remote provider — falls back to localhost:3000 if no env var
        this._resultProvider = new RemoteSpinResultProvider();

        // Frame background (behind reels)
        this._frameBackground = Sprite.from('frame_background');
        this._frameBackground.anchor.set(0.5);
        this.addChild(this._frameBackground);

        // Reel container (centered on frame background)
        this._reelContainer = new Container();
        this._reelContainer.x = -GRID_WIDTH * 0.5;
        this._reelContainer.y = -GRID_HEIGHT * 0.5;
        this.addChild(this._reelContainer);

        // Mask to clip symbols to the grid area
        this._reelMask = new Graphics();
        this._reelMask.rect(0, 0, GRID_WIDTH, GRID_HEIGHT);
        this._reelMask.fill({ color: 0xffffff });
        this._reelContainer.addChild(this._reelMask);
        this._reelContainer.mask = this._reelMask;

        // Create reels
        for (let i = 0; i < REEL_COUNT; i++) {
            const reel = new Reel();
            reel.x = i * CELL_SIZE;
            this._reelContainer.addChild(reel);
            this._reels.push(reel);
        }

        // Set initial symbols from backend session
        this._setInitialSymbols();

        // Frame overlay (on top of reels)
        this._frame = Sprite.from('frame');
        this._frame.anchor.set(0.5);
        this.addChild(this._frame);

        // Debug win text (provisional)
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

        // Listen for signals
        this._unsubscribeSpin = gameSignals.spinPressed.connect(() => this._startSpin());
        this._unsubscribeBet = gameSignals.betChanged.connect(({ amount }) => {
            this._currentBetAmount = amount;
        });

        // Hook into shared ticker for reel updates
        Ticker.shared.add(this._onTick, this);
    }

    protected dispose(): void {
        Ticker.shared.remove(this._onTick, this);
        this._unsubscribeSpin?.();
        this._unsubscribeBet?.();
        for (const timeout of this._stopTimeouts) {
            clearTimeout(timeout);
        }
        this._stopTimeouts.length = 0;
    }

    private _onTick(ticker: Ticker): void {
        const dt = ticker.deltaTime;
        for (const reel of this._reels) {
            reel.update(dt);
        }
    }

    // ── Spin flow ────────────────────────────────────────────────

    private async _startSpin(): Promise<void> {
        if (this._isSpinning) return;
        this._isSpinning = true;

        gameSignals.spinStarted.emit();
        this._debugWinText.visible = false;
        if (this._debugWinTimeout) {
            clearTimeout(this._debugWinTimeout);
            this._debugWinTimeout = undefined;
        }

        // Start reel animations immediately (responsive feel)
        for (let i = 0; i < REEL_COUNT; i++) {
            const timeout = setTimeout(() => {
                this._reels[i].startSpin();
            }, i * REEL_START_INTERVAL);
            this._stopTimeouts.push(timeout);
        }

        // Fetch result from backend while reels spin
        let result: SpinResultWithWins;
        try {
            result = await this._resultProvider.generateResult(this._currentBetAmount);
        } catch (error) {
            console.error('Spin request failed:', error);
            result = this._generateLocalFallback();
        }

        // Schedule stops with the result
        this._scheduleStops(result);
    }

    private _scheduleStops(result: SpinResultWithWins): void {
        let settledCount = 0;

        for (let i = 0; i < REEL_COUNT; i++) {
            const delay = SPIN_MIN_DURATION + i * REEL_STOP_INTERVAL;
            const timeout = setTimeout(() => {
                this._reels[i].onSettled = () => {
                    settledCount++;
                    if (settledCount === REEL_COUNT) {
                        this._onAllReelsStopped(result);
                    }
                };
                this._reels[i].stopAt(result.grid[i]);
            }, delay);
            this._stopTimeouts.push(timeout);
        }
    }

    private _onAllReelsStopped(result: SpinResultWithWins): void {
        this._stopTimeouts.length = 0;
        gameSignals.spinComplete.emit({ grid: result.grid });

        if (result.winAmount > 0) {
            gameSignals.winDetected.emit({
                winAmount: result.winAmount,
                lineWins: result.lineWins,
            });
            this._showDebugWin(`WIN ${result.winAmount.toFixed(2)}€`);
        }

        if (result.bonusTriggered) {
            // Keep _isSpinning = true to block further spins during transition
            gameSignals.bonusTriggered.emit({ scatterCount: result.scatterCount });
            this._showDebugWin(`BONUS! ${result.scatterCount} scatters`);
            setTimeout(() => {
                ScreenManager.I.transitionMap.BASE();
            }, 1500);
            return;
        }

        this._isSpinning = false;
    }

    private _showDebugWin(message: string): void {
        this._debugWinText.text = message;
        this._debugWinText.visible = true;
        if (this._debugWinTimeout) clearTimeout(this._debugWinTimeout);
        this._debugWinTimeout = setTimeout(() => {
            this._debugWinText.visible = false;
        }, 3000);
    }

    // ── Helpers ──────────────────────────────────────────────────

    private _setInitialSymbols(): void {
        const grid = SessionManager.consumeInitialGrid();
        console.log('[DEBUG] initialGrid from backend:', grid ? 'YES' : 'NO (fallback)');
        if (grid) {
            console.log('[DEBUG] grid:', JSON.stringify(grid));
            for (let i = 0; i < REEL_COUNT; i++) {
                this._reels[i].setSymbols(grid[i]);
            }
        } else {
            console.warn('[DEBUG] Using random fallback — backend grid not available');
            for (let i = 0; i < REEL_COUNT; i++) {
                const symbols: SymbolId[] = [];
                for (let row = 0; row < VISIBLE_ROWS; row++) {
                    symbols.push(SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)]);
                }
                this._reels[i].setSymbols(symbols);
            }
        }
    }

    private _generateLocalFallback(): SpinResultWithWins {
        const grid: SymbolId[][] = [];
        for (let r = 0; r < REEL_COUNT; r++) {
            const column: SymbolId[] = [];
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                column.push(SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)]);
            }
            grid.push(column);
        }
        return { grid, winAmount: 0, lineWins: [], scatterCount: 0, bonusTriggered: false };
    }
}
