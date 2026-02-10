import { Sprite, Container, Graphics, Ticker } from 'pixi.js';
import { View, bundle } from '../../../../Abstractions/view';
import { Reel } from '../../../SlotMachine/reel';
import {
    ISpinResultProvider, RemoteSpinResultProvider, LocalSpinResultProvider,
} from '../../../SlotMachine/spin-result-provider';
import { gameSignals } from '../../../../Signals/game-signals';
import type { SpinResult, SymbolId } from '@shared/types';
import { SYMBOL_IDS, REEL_COUNT, VISIBLE_ROWS } from '@shared/types';
import {
    CELL_SIZE, GRID_WIDTH, GRID_HEIGHT,
    SPIN_MIN_DURATION, REEL_START_INTERVAL, REEL_STOP_INTERVAL,
} from '../../../SlotMachine/slot-config';

export class SlotMachineView extends View {
    private _frameBackground!: Sprite;
    private _frame!: Sprite;
    private _reelContainer!: Container;
    private _reelMask!: Graphics;
    private _reels: Reel[] = [];
    private _resultProvider!: ISpinResultProvider;
    private _isSpinning = false;
    private _currentBetAmount = 2;
    private _unsubscribeSpin?: () => void;
    private _unsubscribeBet?: () => void;
    private _stopTimeouts: ReturnType<typeof setTimeout>[] = [];

    bundleNeeded(): bundle {
        return 'base';
    }

    appear(): void {
        // Choose provider based on env
        const apiUrl = import.meta.env.VITE_API_URL;
        this._resultProvider = apiUrl
            ? new RemoteSpinResultProvider()
            : new LocalSpinResultProvider();

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

        // Set initial random symbols (local, no backend call)
        this._setRandomInitialSymbols();

        // Frame overlay (on top of reels)
        this._frame = Sprite.from('frame');
        this._frame.anchor.set(0.5);
        this.addChild(this._frame);

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

        // Start reel animations immediately (responsive feel)
        for (let i = 0; i < REEL_COUNT; i++) {
            const timeout = setTimeout(() => {
                this._reels[i].startSpin();
            }, i * REEL_START_INTERVAL);
            this._stopTimeouts.push(timeout);
        }

        // Fetch result from backend while reels spin
        let result: SpinResult;
        try {
            result = await this._resultProvider.generateResult(this._currentBetAmount);
        } catch (error) {
            console.error('Spin request failed:', error);
            result = this._generateLocalFallback();
        }

        // Schedule stops with the result
        this._scheduleStops(result);
    }

    private _scheduleStops(result: SpinResult): void {
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

    private _onAllReelsStopped(result: SpinResult): void {
        this._isSpinning = false;
        this._stopTimeouts.length = 0;
        gameSignals.spinComplete.emit({ grid: result.grid });
    }

    // ── Helpers ──────────────────────────────────────────────────

    private _setRandomInitialSymbols(): void {
        for (let i = 0; i < REEL_COUNT; i++) {
            const symbols: SymbolId[] = [];
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                symbols.push(SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)]);
            }
            this._reels[i].setSymbols(symbols);
        }
    }

    private _generateLocalFallback(): SpinResult {
        const grid: SymbolId[][] = [];
        for (let r = 0; r < REEL_COUNT; r++) {
            const column: SymbolId[] = [];
            for (let row = 0; row < VISIBLE_ROWS; row++) {
                column.push(SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)]);
            }
            grid.push(column);
        }
        return { grid };
    }
}
