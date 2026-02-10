import { Sprite, Container, Graphics, Ticker } from 'pixi.js';
import { View, bundle } from '../../../../Abstractions/view';
import { Reel } from '../../../SlotMachine/reel';
import { LocalSpinResultGenerator, ISpinResultProvider, SpinResult } from '../../../SlotMachine/spin-result-generator';
import { gameSignals } from '../../../../Signals/game-signals';
import {
    REEL_COUNT, CELL_SIZE, GRID_WIDTH, GRID_HEIGHT,
    SPIN_MIN_DURATION, REEL_START_INTERVAL, REEL_STOP_INTERVAL,
} from '../../../SlotMachine/slot-config';

export class SlotMachineView extends View {
    private _frameBackground!: Sprite;
    private _frame!: Sprite;
    private _reelContainer!: Container;
    private _reelMask!: Graphics;
    private _reels: Reel[] = [];
    private _resultProvider: ISpinResultProvider = new LocalSpinResultGenerator();
    private _isSpinning = false;
    private _unsubscribeSpin?: () => void;
    private _stopTimeouts: ReturnType<typeof setTimeout>[] = [];

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

        // Set initial random symbols
        const initialResult = this._resultProvider.generateResult();
        for (let i = 0; i < REEL_COUNT; i++) {
            this._reels[i].setSymbols(initialResult.grid[i]);
        }

        // Frame overlay (on top of reels)
        this._frame = Sprite.from('frame');
        this._frame.anchor.set(0.5);
        this.addChild(this._frame);

        // Listen for spin signal
        this._unsubscribeSpin = gameSignals.spinPressed.connect(() => this._startSpin());

        // Hook into shared ticker for reel updates
        Ticker.shared.add(this._onTick, this);
    }

    protected dispose(): void {
        Ticker.shared.remove(this._onTick, this);
        this._unsubscribeSpin?.();
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

    private _startSpin(): void {
        if (this._isSpinning) return;
        this._isSpinning = true;

        // Generate result BEFORE animation starts (server-ready)
        const result = this._resultProvider.generateResult();

        gameSignals.spinStarted.emit();

        // Stagger reel starts
        for (let i = 0; i < REEL_COUNT; i++) {
            const timeout = setTimeout(() => {
                this._reels[i].startSpin();
            }, i * REEL_START_INTERVAL);
            this._stopTimeouts.push(timeout);
        }

        // Schedule sequential stops after minimum spin duration
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
}
