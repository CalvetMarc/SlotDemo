import { ViewRegistry } from "../../../../Managers/ViewFactory";
import { BaseBackgroundView } from "../../SplashScreen/views/BaseBackgroundView";
import { FogOverlayView } from "../../SplashScreen/views/FogOverlayView";
import { FliesView } from "../views/FliesView";
import { FrameBackgroundView } from "../views/FrameBackgroundView";
import { FrameView } from "../views/FrameView";
import { SlotLogoView } from "../views/SlotLogoView";
import { BatsView } from "../views/BatsView";

// UI Components
import { SpinControlsView } from "../../../UI/SpinControlsView";
import { BetDisplayView } from "../../../UI/BetDisplayView";
import { BalanceDisplayView } from "../../../UI/BalanceDisplayView";
import { BuyBonusButtonView } from "../../../UI/BuyBonusButtonView";
import { MenuButtonView } from "../../../UI/MenuButtonView";
import { AudioButtonView } from "../../../UI/AudioButtonView";

export const BASE_VIEW_REGISTRY: ViewRegistry = {
    BaseBackgroundView,
    FogOverlayView,
    FliesView,
    FrameBackgroundView,
    FrameView,
    SlotLogoView,
    BatsView,
    // UI Components
    SpinControlsView,
    BetDisplayView,
    BalanceDisplayView,
    BuyBonusButtonView,
    MenuButtonView,
    AudioButtonView
};
