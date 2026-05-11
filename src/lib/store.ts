import { EventEmitter } from "node:events";
import type {
  AuditEntry,
  CrashEvent,
  Drink,
  Order,
  PricePoint,
  RealtimeEvent,
  Settings,
} from "./types";
import { seedDrinks } from "./seed";
import { nowIso } from "./time";

const HISTORY_CAP = 2000;
const SPARK_WINDOW = 25;

export interface Store {
  drinks: Map<string, Drink>;
  history: Map<string, PricePoint[]>;
  crash: CrashEvent | null;
  crashHistory: CrashEvent[];
  orders: Order[];
  audit: AuditEntry[];
  settings: Settings;
  shiftId: string;
  nextOrderNumber: number;
  emitter: EventEmitter;
  tickStarted: boolean;
  crashTimer: NodeJS.Timeout | null;
}

function defaultSettings(): Settings {
  return {
    decayRate: 0.04,
    noiseLevel: 0.004,
    volatility: 0.05,
    minPriceMultiplier: 0.5,
    maxPriceMultiplier: 2.5,
    minMarginMultiplier: 0.3,
    tickIntervalMs: 2000,
    gstRate: 0.1,
    crashCooldownMs: 20 * 60 * 1000,
    perShiftMaxDiscount: 0.5,
    tradingOpen: process.env.TRADING_OPEN ?? "16:00",
    tradingClose: process.env.TRADING_CLOSE ?? "02:00",
  };
}

function createStore(): Store {
  const drinks = new Map<string, Drink>();
  const history = new Map<string, PricePoint[]>();
  const ts = Date.now();
  for (const d of seedDrinks()) {
    drinks.set(d.id, d);
    history.set(d.id, [{ ts, price: d.currentPrice }]);
  }
  const emitter = new EventEmitter();
  emitter.setMaxListeners(200);
  return {
    drinks,
    history,
    crash: null,
    crashHistory: [],
    orders: [],
    audit: [],
    settings: defaultSettings(),
    shiftId: `shift-${ts}`,
    nextOrderNumber: 1,
    emitter,
    tickStarted: false,
    crashTimer: null,
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __DRINK_EXCHANGE_STORE__: Store | undefined;
}

export const store: Store =
  globalThis.__DRINK_EXCHANGE_STORE__ ?? (globalThis.__DRINK_EXCHANGE_STORE__ = createStore());

export function broadcast(evt: RealtimeEvent): void {
  store.emitter.emit("event", evt);
}

export function recordAudit(actor: string, action: string, detail: Record<string, unknown>): void {
  store.audit.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: nowIso(),
    actor,
    action,
    detail,
  });
  if (store.audit.length > 1000) store.audit.length = 1000;
}

export function pushHistory(drinkId: string, ts: number, price: number): void {
  let arr = store.history.get(drinkId);
  if (!arr) {
    arr = [];
    store.history.set(drinkId, arr);
  }
  arr.push({ ts, price });
  if (arr.length > HISTORY_CAP) arr.splice(0, arr.length - HISTORY_CAP);
}

export function recentSpark(drinkId: string, n = SPARK_WINDOW): PricePoint[] {
  const arr = store.history.get(drinkId) ?? [];
  return arr.slice(-n);
}

export function activeDrinks(): Drink[] {
  return [...store.drinks.values()]
    .filter((d) => d.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
