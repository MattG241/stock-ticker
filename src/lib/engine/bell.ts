import { store, recordAudit } from "../store";
import { startCrash } from "./crash";

const BELL_MINUTES_BEFORE_CLOSE = 5;
const BELL_DURATION_S = 240;
const BELL_DISCOUNT = 0.2;

function parseHM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map((n) => parseInt(n, 10));
  return { h: h ?? 0, m: m ?? 0 };
}

function currentLocalMinutes(): number {
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Adelaide",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = parseInt(fmt.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(fmt.find((p) => p.type === "minute")?.value ?? "0", 10);
  return hour * 60 + minute;
}

export function checkClosingBell(): void {
  const close = parseHM(store.settings.tradingClose);
  const closeMin = close.h * 60 + close.m;
  const now = currentLocalMinutes();
  // Closing time wraps overnight (e.g. close 02:00). Normalise so the bell
  // fires when we're within BELL_MINUTES_BEFORE_CLOSE before close, regardless
  // of crossing midnight.
  const delta = (closeMin - now + 24 * 60) % (24 * 60);
  if (delta === BELL_MINUTES_BEFORE_CLOSE && !store.bellArmed) {
    store.bellArmed = true;
    const result = startCrash({
      discountPercent: BELL_DISCOUNT,
      durationSeconds: BELL_DURATION_S,
      triggeredBy: "closing-bell",
      triggeredVia: "closing-bell",
    });
    recordAudit("closing-bell", "crash.last-call", { ok: result.ok });
  }
  if (delta > BELL_MINUTES_BEFORE_CLOSE + 5) {
    // Re-arm during the day
    store.bellArmed = false;
  }
}

export function ensureClosingBell(): void {
  setInterval(checkClosingBell, 30_000);
}
