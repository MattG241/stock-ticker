import { broadcast, store } from "../store";
import type { MarginAlert } from "../types";
import { getActiveCrash } from "./crash";
import { nowIso } from "../time";

const ALERT_WINDOW_MS = 5 * 60_000;

export function listMarginAlerts(): MarginAlert[] {
  return [...store.marginAlerts.values()];
}

export function ensureAlerts(): void {
  if (store.alertsStarted) return;
  store.alertsStarted = true;
  setInterval(scanMargins, 5000);
}

function scanMargins() {
  const crash = getActiveCrash();
  const settings = store.settings;
  if (!crash.active || !crash.event) {
    if (store.marginAlerts.size) {
      store.marginAlerts.clear();
    }
    return;
  }
  for (const d of store.drinks.values()) {
    if (!d.isDynamic || !d.isActive) continue;
    const floor = d.costPrice * (1 + settings.minMarginMultiplier);
    const discounted = d.currentPrice * (1 - crash.event.discountPercent);
    if (discounted < floor) {
      if (!store.marginAlerts.has(d.id)) {
        store.marginAlerts.set(d.id, {
          drinkId: d.id,
          drinkName: d.name,
          enteredAt: nowIso(),
          floor,
        });
      } else {
        const a = store.marginAlerts.get(d.id)!;
        if (Date.now() - new Date(a.enteredAt).getTime() > ALERT_WINDOW_MS) {
          broadcast({
            type: "settings.updated",
            payload: store.settings,
          });
        }
      }
    } else {
      store.marginAlerts.delete(d.id);
    }
  }
}
