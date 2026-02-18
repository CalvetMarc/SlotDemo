import { ViewRegistry } from '../../../../Managers/view-factory';
import { BonusBackgroundView } from '../views/bonus-background-view';
import { BonusLogoView } from '../views/bonus-logo-view';
import { ChestView } from '../views/chest-view';
import { BonusWinCounterView } from '../views/bonus-win-counter-view';

export const BONUS_VIEW_REGISTRY: ViewRegistry = {
    BonusBackgroundView,
    BonusLogoView,
    ChestView,
    BonusWinCounterView,
};
