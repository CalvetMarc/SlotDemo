import { ViewRegistry } from "../../../../Managers/view-factory";
import { BaseBackgroundView } from "../../SplashScreen/views/base-background-view";
import { FogOverlayView } from "../../SplashScreen/views/fog-overlay-view";
import { FliesView } from "../views/flies-view";
import { SlotMachineView } from "../views/slot-machine-view";
import { SlotLogoView } from "../views/slot-logo-view";
import { BatsView } from "../views/bats-view";

// UI Components
import { SpinControlsView } from "../../../UI/spin-controls-view";
import { MobileSpinControlsView } from "../../../UI/mobile-spin-controls-view";
import { MobileSecondaryControlsView } from "../../../UI/mobile-secondary-controls-view";
import { MobileBalanceDisplayView } from "../../../UI/mobile-balance-display-view";
import { MobileBuyBonusButtonView } from "../../../UI/mobile-buy-bonus-button-view";
import { MobileBetDisplayView } from "../../../UI/mobile-bet-display-view";
import { MobileAutoTurboView } from "../../../UI/mobile-auto-turbo-view";
import { MobileControlsPanelView } from "../../../UI/mobile-controls-panel-view";
import { BetDisplayView } from "../../../UI/bet-display-view";
import { BalanceDisplayView } from "../../../UI/balance-display-view";
import { BuyBonusButtonView } from "../../../UI/buy-bonus-button-view";
import { MenuButtonView } from "../../../UI/menu-button-view";
import { AudioButtonView } from "../../../UI/audio-button-view";

export const BASE_VIEW_REGISTRY: ViewRegistry = {
    BaseBackgroundView,
    FogOverlayView,
    FliesView,
    SlotMachineView,
    SlotLogoView,
    BatsView,
    // UI Components
    SpinControlsView,
    MobileSpinControlsView,
    MobileSecondaryControlsView,
    MobileBalanceDisplayView,
    MobileBuyBonusButtonView,
    MobileBetDisplayView,
    MobileAutoTurboView,
    MobileControlsPanelView,
    BetDisplayView,
    BalanceDisplayView,
    BuyBonusButtonView,
    MenuButtonView,
    AudioButtonView,
};
