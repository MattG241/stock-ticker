import { EventEmitter } from "node:events";
import type {
  AuditEntry,
  CrashEvent,
  CustomerView,
  Drink,
  MarginAlert,
  Order,
  PricePoint,
  RealtimeEvent,
  RefusalEntry,
  ScheduledCrash,
  Settings,
  Shift,
  StaffMember,
} from "./types";
import { seedDrinks } from "./seed";
import { nowIso } from "./time";
import { hashPin } from "./crypto";

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
  shifts: Shift[];
  shiftId: string;
  nextOrderNumber: number;
  staff: Map<string, StaffMember>;
  scheduledCrashes: ScheduledCrash[];
  marginAlerts: Map<string, MarginAlert>;
  refusals: RefusalEntry[];
  idempotency: Map<string, { orderId: string; ts: number }>;
  recentSales: { id: string; ticker: string; name: string; quantity: number; total: number; ts: number }[];
  socialWebhookToken: string;
  socialWebhookCooldownAt: number;
  emitter: EventEmitter;
  tickStarted: boolean;
  scheduleStarted: boolean;
  alertsStarted: boolean;
  bellArmed: boolean;
  crashTimer: NodeJS.Timeout | null;
  customerView: CustomerView;
}

export function emptyCustomerView(): CustomerView {
  return {
    lines: [],
    subtotal: 0,
    discountAmount: 0,
    discountReason: null,
    tipAmount: 0,
    cashAdjustment: 0,
    total: 0,
    paymentMethod: null,
    cashTendered: null,
    changeDue: null,
    status: "idle",
    lastOrderNumber: null,
    lastReceiptUrl: null,
    updatedAt: new Date().toISOString(),
  };
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
  const shiftId = `shift-${ts}`;
  const staff = new Map<string, StaffMember>();
  const now = new Date(ts).toISOString();
  const ownerPin = process.env.SEED_OWNER_PIN ?? "9999";
  const managerPin = process.env.SEED_MANAGER_PIN ?? "5678";
  const staffPin = process.env.SEED_STAFF_PIN ?? "1234";
  staff.set("owner-1", {
    id: "owner-1",
    name: "Owner",
    email: "owner@thedrinkexchange.com.au",
    pinHash: hashPin(ownerPin),
    role: "owner",
    isActive: true,
    createdAt: now,
  });
  staff.set("manager-1", {
    id: "manager-1",
    name: "Manager",
    email: "manager@thedrinkexchange.com.au",
    pinHash: hashPin(managerPin),
    role: "manager",
    isActive: true,
    createdAt: now,
  });
  staff.set("staff-1", {
    id: "staff-1",
    name: "Staff",
    email: "staff@thedrinkexchange.com.au",
    pinHash: hashPin(staffPin),
    role: "staff",
    isActive: true,
    createdAt: now,
  });
  return {
    drinks,
    history,
    crash: null,
    crashHistory: [],
    orders: [],
    audit: [],
    settings: defaultSettings(),
    shifts: [{ id: shiftId, openedAt: now, closedAt: null, openedBy: "system", closedBy: null }],
    shiftId,
    nextOrderNumber: 1,
    staff,
    scheduledCrashes: [],
    marginAlerts: new Map(),
    refusals: [],
    idempotency: new Map(),
    recentSales: [],
    socialWebhookToken: process.env.CRASH_WEBHOOK_TOKEN ?? "dev-webhook-token",
    socialWebhookCooldownAt: 0,
    emitter,
    tickStarted: false,
    scheduleStarted: false,
    alertsStarted: false,
    bellArmed: false,
    crashTimer: null,
    customerView: emptyCustomerView(),
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
  const entry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: nowIso(),
    actor,
    action,
    detail,
  };
  store.audit.unshift(entry);
  if (store.audit.length > 1000) store.audit.length = 1000;
  // Async write-through to Postgres journal if DATABASE_URL is set.
  void import("./db/repos")
    .then((m) => m.persistAudit(entry))
    .catch((err) => console.error("[persist] audit failed", err));
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
