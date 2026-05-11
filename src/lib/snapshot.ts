import { activeDrinks, recentSpark, store } from "./store";
import { effectiveDisplayPrice, getActiveCrash } from "./engine/crash";
import { isWithinTradingHours } from "./time";
import { roundCurrency } from "./money";
import type { Drink, PricePoint } from "./types";

export interface SnapshotDrink extends Drink {
  displayPrice: number;
  spark: PricePoint[];
}

export interface Snapshot {
  serverTime: string;
  tradingOpen: boolean;
  marketIndexPct: number;
  drinks: SnapshotDrink[];
  crash: {
    active: boolean;
    event: ReturnType<typeof getActiveCrash>["event"];
    remainingSeconds: number;
  };
  settings: typeof store.settings;
  shiftId: string;
}

export function buildSnapshot(): Snapshot {
  const crash = getActiveCrash();
  const drinks = activeDrinks();
  const enriched: SnapshotDrink[] = drinks.map((d) => ({
    ...d,
    displayPrice: roundCurrency(effectiveDisplayPrice(d, crash)),
    spark: recentSpark(d.id),
  }));
  const dyn = enriched.filter((d) => d.isDynamic);
  const idx = dyn.length
    ? dyn.reduce((s, d) => s + (d.currentPrice - d.basePrice) / d.basePrice, 0) / dyn.length
    : 0;
  return {
    serverTime: new Date().toISOString(),
    tradingOpen: isWithinTradingHours(store.settings.tradingOpen, store.settings.tradingClose),
    marketIndexPct: idx * 100,
    drinks: enriched,
    crash,
    settings: store.settings,
    shiftId: store.shiftId,
  };
}
