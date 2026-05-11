import { store } from "../store";

export interface BiggestMover {
  drinkId: string;
  ticker: string;
  name: string;
  fromPrice: number;
  toPrice: number;
  pctChange: number;
}

const WINDOW_MS = 5 * 60_000;

export function biggestMover(): BiggestMover | null {
  const now = Date.now();
  let best: BiggestMover | null = null;
  for (const drink of store.drinks.values()) {
    if (!drink.isDynamic || !drink.isActive) continue;
    const hist = store.history.get(drink.id) ?? [];
    if (hist.length < 2) continue;
    const startIdx = hist.findIndex((p) => p.ts >= now - WINDOW_MS);
    const startPoint = startIdx >= 0 ? hist[startIdx] : hist[0];
    const fromPrice = startPoint.price;
    const toPrice = drink.currentPrice;
    if (fromPrice <= 0) continue;
    const pct = ((toPrice - fromPrice) / fromPrice) * 100;
    if (!best || Math.abs(pct) > Math.abs(best.pctChange)) {
      best = {
        drinkId: drink.id,
        ticker: drink.ticker,
        name: drink.name,
        fromPrice,
        toPrice,
        pctChange: pct,
      };
    }
  }
  return best;
}

export function recentSales() {
  return store.recentSales.slice(0, 8);
}
