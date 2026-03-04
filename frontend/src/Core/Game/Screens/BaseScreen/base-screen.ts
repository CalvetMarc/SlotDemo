import { Assets } from "pixi.js";
import { GameScreen, ScreenConfig } from "../../../Abstractions/game-screen"
import { BASE_VIEW_REGISTRY } from "./config/base-scene-loader";
import baseConfig from "./config/base-scene-config.json"
import { BuyBonusPanelView } from "../../UI/buy-bonus-panel-view";
import { InfoPanelView } from "../../UI/info-panel-view";
import { gameSignals } from "../../../Signals/game-signals";
import { GameModel } from "../../SlotMachine/game-model";
import { AudioManager } from "../../../Audio/audio-manager";

export class BaseScreen extends GameScreen{

    private _panel?: BuyBonusPanelView;
    private _unsubBuyPressed?: () => void;
    private _unsubBetChanged?: () => void;
    private _unsubSpinning?: () => void;
    private _unsubSessionExpired?: () => void;
    private _unsubBalanceUpdated?: () => void;
    private _resizeHandler?: () => void;

    private _infoPanel?: InfoPanelView;
    private _unsubInfoPressed?: () => void;
    private _unsubInfoSpinning?: () => void;
    private _unsubInfoSessionExpired?: () => void;
    private _infoResizeHandler?: () => void;

    constructor(){
        super();
    }

    async load(): Promise<void> {
        await Promise.all([
            this.loadConfig(baseConfig as ScreenConfig, BASE_VIEW_REGISTRY),
            Assets.loadBundle('win'),
        ]);
    }

    async onEnter(): Promise<void> {
        if (this.isDetached) {
            this.reattachViews();
        } else {
            this.addViewsToLayers();
        }

        this._setupPanel();
        this._setupInfoPanel();
    }

    onUpdate(deltaMS: number): void {
    }

    async onExit(): Promise<void> {
        this._teardownPanel();
        this._teardownInfoPanel();
    }

    // ── Panel lifecycle ──────────────────────────────────────────

    private _setupPanel(): void {
        this._panel = new BuyBonusPanelView(
            (tier) => {
                this._panel?.hide();
                gameSignals.buyBonusConfirmed.emit({ tier });
            },
            () => {
                this._panel?.hide();
            },
        );
        this._panel.zIndex = 100;

        // Add to the layer manager root (sortableChildren = true)
        this.layerManager.root.addChild(this._panel);

        // Wire signals
        this._unsubBuyPressed = gameSignals.buyBonusPressed.connect(() => {
            const vp = getViewportSize();
            this._panel?.show(vp.width, vp.height);
        });

        this._unsubBetChanged = GameModel.betChanged.connect(() => {
            this._panel?.updatePrices(GameModel.betAmount);
        });

        this._unsubSpinning = GameModel.spinningChanged.connect(({ isSpinning }) => {
            if (isSpinning && this._panel?.isOpen) {
                this._panel.hide();
            }
        });

        this._unsubSessionExpired = gameSignals.sessionExpired.connect(() => {
            if (this._panel?.isOpen) {
                this._panel.hide();
            }
        });

        this._unsubBalanceUpdated = gameSignals.balanceUpdated.connect(() => {
            if (this._panel?.isOpen) {
                this._panel.updatePrices(GameModel.betAmount);
            }
        });

        // Resize listener
        this._resizeHandler = () => {
            const vp = getViewportSize();
            if (vp.width > 0 && vp.height > 0) {
                this._panel?.resize(vp.width, vp.height);
            }
        };
        window.addEventListener('resize', this._resizeHandler);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this._resizeHandler);
        }
    }

    // ── Info panel lifecycle ────────────────────────────────────────

    private _setupInfoPanel(): void {
        this._infoPanel = new InfoPanelView(() => {
            this._infoPanel?.hide();
        });
        this._infoPanel.zIndex = 100;
        this.layerManager.root.addChild(this._infoPanel);

        this._unsubInfoPressed = gameSignals.infoPressed.connect(() => {
            const vp = getViewportSize();
            this._infoPanel?.show(vp.width, vp.height);
        });

        this._unsubInfoSpinning = GameModel.spinningChanged.connect(({ isSpinning }) => {
            if (isSpinning && this._infoPanel?.isOpen) {
                this._infoPanel.hide();
            }
        });

        this._unsubInfoSessionExpired = gameSignals.sessionExpired.connect(() => {
            if (this._infoPanel?.isOpen) {
                this._infoPanel.hide();
            }
        });

        this._infoResizeHandler = () => {
            const vp = getViewportSize();
            if (vp.width > 0 && vp.height > 0) {
                this._infoPanel?.resize(vp.width, vp.height);
            }
        };
        window.addEventListener('resize', this._infoResizeHandler);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this._infoResizeHandler);
        }
    }

    private _teardownInfoPanel(): void {
        this._unsubInfoPressed?.();
        this._unsubInfoSpinning?.();
        this._unsubInfoSessionExpired?.();

        if (this._infoResizeHandler) {
            window.removeEventListener('resize', this._infoResizeHandler);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', this._infoResizeHandler);
            }
            this._infoResizeHandler = undefined;
        }

        if (this._infoPanel) {
            this._infoPanel.destroy({ children: true });
            this._infoPanel = undefined;
        }
    }

    private _teardownPanel(): void {
        this._unsubBuyPressed?.();
        this._unsubBetChanged?.();
        this._unsubSpinning?.();
        this._unsubSessionExpired?.();
        this._unsubBalanceUpdated?.();

        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', this._resizeHandler);
            }
            this._resizeHandler = undefined;
        }

        if (this._panel) {
            this._panel.destroy({ children: true });
            this._panel = undefined;
        }
    }
}

// ── Helpers ──────────────────────────────────────────────────────

function getViewportSize(): { width: number; height: number } {
    if (window.visualViewport) {
        return { width: window.visualViewport.width, height: window.visualViewport.height };
    }
    return {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
    };
}
