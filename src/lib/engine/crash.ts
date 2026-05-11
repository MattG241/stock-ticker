import { ulid } from "ulid";
import { broadcast, recordAudit, store } from "../store";
import type { CrashEvent, Drink } from "../types";
import { nowIso } from "../time";

export interface ActiveCrashView {
  active: boolean;
  event: CrashEvent | null;
  remainingSeconds: number;
}

export function getActiveCrash(): ActiveCrashView {
  const c = store.crash;
  if (!c) return { active: false, event: null, remainingSeconds: 0 };
  const endsAt = new Date(c.endsAt).getTime();
  const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
  return { active: remaining > 0, event: c, remainingSeconds: remaining };
}

export function effectiveDisplayPrice(d: Drink, crash: ActiveCrashView): number {
  if (!crash.active || !d.isDynamic || !d.isActive) return d.currentPrice;
  const discounted = d.currentPrice * (1 - (crash.event?.discountPercent ?? 0));
  const floor = d.costPrice * (1 + store.settings.minMarginMultiplier);
  return Math.max(discounted, floor);
}

export function startCrash(opts: {
  discountPercent: number;
  durationSeconds: number;
  triggeredBy: string;
  triggeredVia?: CrashEvent["triggeredVia"];
}): { ok: true; event: CrashEvent } | { ok: false; reason: string } {
  const { settings } = store;
  if (opts.discountPercent <= 0 || opts.discountPercent > settings.perShiftMaxDiscount) {
    return {
      ok: false,
      reason: `Discount must be between 0 and ${Math.round(settings.perShiftMaxDiscount * 100)}%`,
    };
  }
  if (opts.durationSeconds <= 0 || opts.durationSeconds > 600) {
    return { ok: false, reason: "Duration must be 1-600 seconds" };
  }
  const active = getActiveCrash();
  if (active.active) return { ok: false, reason: "A crash is already running" };

  const recent = store.crashHistory[0];
  if (recent) {
    const since = Date.now() - new Date(recent.endsAt).getTime();
    if (since < settings.crashCooldownMs) {
      const wait = Math.ceil((settings.crashCooldownMs - since) / 1000);
      return { ok: false, reason: `Cooldown active, retry in ${wait}s` };
    }
  }

  const now = new Date();
  const event: CrashEvent = {
    id: ulid(),
    startedAt: now.toISOString(),
    endsAt: new Date(now.getTime() + opts.durationSeconds * 1000).toISOString(),
    discountPercent: opts.discountPercent,
    triggeredBy: opts.triggeredBy,
    triggeredVia: opts.triggeredVia ?? "manual",
    totalOrdersDuringCrash: 0,
    totalRevenueDuringCrash: 0,
    cancelledEarly: false,
  };
  store.crash = event;
  recordAudit(opts.triggeredBy, "crash.start", {
    discountPercent: opts.discountPercent,
    durationSeconds: opts.durationSeconds,
  });
  broadcast({ type: "crash.started", payload: event });

  if (store.crashTimer) clearInterval(store.crashTimer);
  store.crashTimer = setInterval(() => {
    const view = getActiveCrash();
    if (!view.active) {
      endCrash(false, "system");
    } else {
      broadcast({ type: "crash.tick", payload: { remainingSeconds: view.remainingSeconds } });
    }
  }, 1000);
  return { ok: true, event };
}

export function endCrash(cancelledEarly: boolean, actor: string): void {
  const c = store.crash;
  if (!c) return;
  c.cancelledEarly = cancelledEarly;
  store.crashHistory.unshift(c);
  if (store.crashHistory.length > 100) store.crashHistory.length = 100;
  if (store.crashTimer) {
    clearInterval(store.crashTimer);
    store.crashTimer = null;
  }
  store.crash = null;
  recordAudit(actor, "crash.end", { crashEventId: c.id, cancelledEarly });
  broadcast({
    type: "crash.ended",
    payload: { crashEventId: c.id, cancelledEarly },
  });
}

export function checkMarginFloors(): { drinkId: string; floor: number }[] {
  const crash = getActiveCrash();
  if (!crash.active) return [];
  const hits: { drinkId: string; floor: number }[] = [];
  for (const d of store.drinks.values()) {
    if (!d.isDynamic || !d.isActive) continue;
    const floor = d.costPrice * (1 + store.settings.minMarginMultiplier);
    const discounted = d.currentPrice * (1 - (crash.event?.discountPercent ?? 0));
    if (discounted < floor) hits.push({ drinkId: d.id, floor });
  }
  return hits;
}

export const _internalNowIso = nowIso;
