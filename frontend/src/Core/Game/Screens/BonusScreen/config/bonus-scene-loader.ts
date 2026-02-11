import { ViewRegistry } from '../../../../Managers/view-factory';
import { BonusBackgroundView } from '../views/bonus-background-view';
import { ChestView } from '../views/chest-view';
import { BonusWinCounterView } from '../views/bonus-win-counter-view';

export const BONUS_VIEW_REGISTRY: ViewRegistry = {
    BonusBackgroundView,
    ChestView,
    BonusWinCounterView,
};
