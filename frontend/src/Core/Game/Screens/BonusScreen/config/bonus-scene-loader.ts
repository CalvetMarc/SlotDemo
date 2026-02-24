import { ViewRegistry } from '../../../../Managers/view-factory';
import { BaseBackgroundView } from '../../SplashScreen/views/base-background-view';
import { BonusLogoView } from '../views/bonus-logo-view';
import { BonusStairsView } from '../views/bonus-stairs-view';
import { ChestView } from '../views/chest-view';
import { BonusWinCounterView } from '../views/bonus-win-counter-view';
import { BonusHintView } from '../views/bonus-hint-view';

export const BONUS_VIEW_REGISTRY: ViewRegistry = {
    BaseBackgroundView,
    BonusLogoView,
    BonusStairsView,
    ChestView,
    BonusWinCounterView,
    BonusHintView,
};
