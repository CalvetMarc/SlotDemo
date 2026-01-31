import { ViewRegistry } from "../../../../Orchestors/ViewFactory";
import { BaseBackgroundView } from "../../SplashScreen/views/BaseBackgroundView";
import { FogOverlayView } from "../../SplashScreen/views/FogOverlayView";
import { FliesView } from "../views/FliesView";
import { FrameBackgroundView } from "../views/FrameBackgroundView";
import { FrameView } from "../views/FrameView";
import { SlotLogoView } from "../views/SlotLogoView";
import { BatsView } from "../views/BatsView";

// UI Components
import { SpinButtonView } from "../../../UI/SpinButtonView";
import { BetDisplayView } from "../../../UI/BetDisplayView";
import { BalanceDisplayView } from "../../../UI/BalanceDisplayView";
import { BuyBonusButtonView } from "../../../UI/BuyBonusButtonView";
import { MenuButtonView } from "../../../UI/MenuButtonView";
import { AutoSpinButtonView } from "../../../UI/AutoSpinButtonView";
import { TurboButtonView } from "../../../UI/TurboButtonView";
import { AudioButtonView } from "../../../UI/AudioButtonView";
import { InfoButtonView } from "../../../UI/InfoButtonView";

export const BASE_VIEW_REGISTRY: ViewRegistry = {
    BaseBackgroundView,
    FogOverlayView,
    FliesView,
    FrameBackgroundView,
    FrameView,
    SlotLogoView,
    BatsView,
    // UI Components
    SpinButtonView,
    BetDisplayView,
    BalanceDisplayView,
    BuyBonusButtonView,
    MenuButtonView,
    AutoSpinButtonView,
    TurboButtonView,
    AudioButtonView,
    InfoButtonView
};
