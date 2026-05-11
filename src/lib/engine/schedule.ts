import { ulid } from "ulid";
import { recordAudit, store } from "../store";
import { startCrash } from "./crash";
import type { ScheduledCrash } from "../types";

export function listSchedules(): ScheduledCrash[] {
  return [...store.scheduledCrashes].sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}

export function scheduleCrash(input: {
  fireAt: string;
  discountPercent: number;
  durationSeconds: number;
  label?: string;
}): ScheduledCrash {
  const sc: ScheduledCrash = {
    id: ulid(),
    fireAt: input.fireAt,
    discountPercent: input.discountPercent,
    durationSeconds: input.durationSeconds,
    label: input.label,
    fired: false,
    cancelled: false,
  };
  store.scheduledCrashes.push(sc);
  recordAudit("admin", "crash.schedule", { id: sc.id, fireAt: sc.fireAt });
  return sc;
}

export function cancelSchedule(id: string): boolean {
  const sc = store.scheduledCrashes.find((x) => x.id === id);
  if (!sc || sc.fired) return false;
  sc.cancelled = true;
  recordAudit("admin", "crash.schedule.cancel", { id });
  return true;
}

export function ensureScheduler(): void {
  if (store.scheduleStarted) return;
  store.scheduleStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const sc of store.scheduledCrashes) {
      if (sc.fired || sc.cancelled) continue;
      const fire = new Date(sc.fireAt).getTime();
      if (fire <= now && now - fire < 60_000) {
        sc.fired = true;
        const result = startCrash({
          discountPercent: sc.discountPercent,
          durationSeconds: sc.durationSeconds,
          triggeredBy: "scheduler",
          triggeredVia: "scheduled",
        });
        recordAudit("scheduler", "crash.schedule.fire", {
          id: sc.id,
          ok: result.ok,
          reason: result.ok ? undefined : result.reason,
        });
      }
    }
  }, 5000);
}
