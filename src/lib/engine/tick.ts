import { broadcast, pushHistory, store } from "../store";
import { clamp, roundCurrency } from "../money";
import { isWithinTradingHours } from "../time";

function tickOnce(): void {
  const { settings, drinks } = store;
  if (!isWithinTradingHours(settings.tradingOpen, settings.tradingClose)) {
    return;
  }
  const ts = Date.now();
  const updates: { drinkId: string; currentPrice: number; ts: number }[] = [];
  for (const drink of drinks.values()) {
    if (!drink.isDynamic || !drink.isActive || !drink.inStock) continue;
    const drift = (drink.basePrice - drink.currentPrice) * settings.decayRate;
    const noise = (Math.random() * 2 - 1) * drink.basePrice * settings.noiseLevel;
    const next = clamp(
      drink.currentPrice + drift + noise,
      drink.basePrice * drink.minPriceMultiplier,
      drink.basePrice * drink.maxPriceMultiplier,
    );
    const rounded = roundCurrency(next);
    if (rounded !== drink.currentPrice) {
      drink.currentPrice = rounded;
      drink.updatedAt = new Date(ts).toISOString();
    }
    pushHistory(drink.id, ts, drink.currentPrice);
    updates.push({ drinkId: drink.id, currentPrice: drink.currentPrice, ts });
  }
  if (updates.length) {
    broadcast({ type: "price.tick", payload: updates });
  }
}

export function ensureTickEngine(): void {
  if (store.tickStarted) return;
  store.tickStarted = true;
  setInterval(tickOnce, store.settings.tickIntervalMs);
}
