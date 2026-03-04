import { View } from "../../../../Abstractions/view";
import { BaseBackgroundView } from "../views/base-background-view";
import { FogOverlayView } from "../views/fog-overlay-view";
import { GameLogoView } from "../views/game-logo-view";
import { LoadingGameView } from "../views/loading-game-view";
import { PressToContinueView } from "../views/press-to-continue-view";

type ViewCtor = new () => View;

export const SPLASH_VIEW_REGISTRY: Record<string, ViewCtor> = {
  GameLogoView,
  BaseBackgroundView,
  FogOverlayView,
  LoadingGameView,
  PressToContinueView
};
