import { View } from "../../../../Abstractions/View";
import { BaseBackgroundView } from "../views/BaseBackgroundView";
import { FogOverlayView } from "../views/FogOverlayView";
import { GameLogoView } from "../views/GameLogoView";
import { LoadingGameView } from "../views/LoadingGameView";

type ViewCtor = new () => View;

export const SPLASH_VIEW_REGISTRY: Record<string, ViewCtor> = {
  GameLogoView,
  BaseBackgroundView,
  FogOverlayView,
  LoadingGameView
};
