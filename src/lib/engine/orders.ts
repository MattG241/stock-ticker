import { ulid } from "ulid";
import { broadcast, pushHistory, recordAudit, store } from "../store";
import type { Drink, Order, OrderLine } from "../types";
import { roundCashAud, roundCurrency } from "../money";
import { nowIso, isWithinTradingHours } from "../time";
import { effectiveDisplayPrice, getActiveCrash, type ActiveCrashView } from "./crash";
import { getPaymentProvider } from "../providers/payment";
import { getReceiptProvider } from "../providers/receipt";
import { persistOrder } from "../db/repos";

const IDEMPOTENCY_TTL_MS = 5 * 60_000;
const RECENT_SALES_CAP = 12;

// Customer-quoted price is honored if it's within this tolerance of the server-effective
// price at submission time. Outside this band, the staff must re-quote the customer.
const PRICE_TOLERANCE_REL = 0.05; // 5%
const PRICE_TOLERANCE_ABS = 0.5; // 50c

export interface PlaceOrderItem {
  drinkId: string;
  quantity: number;
  // Optional - the unit price the staff member quoted to the customer.
  // If absent, the server-effective price is used.
  expectedUnitPrice?: number;
}

export interface PlaceOrderInput {
  staffId: string;
  paymentMethod: Exclude<Order["paymentMethod"], "split">;
  notes?: string;
  items: PlaceOrderItem[];
  tabId?: string;
  receipt?: { channel: "email" | "sms"; to: string };
  idempotencyKey?: string;
  idCheck?: boolean;
  cashTendered?: number;
}

export type PlaceOrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: string };

interface PricedLine {
  line: OrderLine;
  drink: Drink;
  newPrice: number; // post-impact price for this drink (only relevant if isDynamic)
}

interface LinePlan {
  lines: PricedLine[];
  subtotalDelta: number;
}

function pruneIdempotency() {
  const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
  for (const [k, v] of store.idempotency) {
    if (v.ts < cutoff) store.idempotency.delete(k);
  }
}

function rememberSale(order: Order) {
  for (const line of order.lines) {
    store.recentSales.unshift({
      id: `${order.id}-${line.id}`,
      ticker: store.drinks.get(line.drinkId)?.ticker ?? "—",
      name: line.drinkNameSnapshot,
      quantity: line.quantity,
      total: line.lineTotal,
      ts: Date.now(),
    });
  }
  if (store.recentSales.length > RECENT_SALES_CAP) {
    store.recentSales.length = RECENT_SALES_CAP;
  }
}

function priceWithinTolerance(expected: number, effective: number): boolean {
  const delta = Math.abs(expected - effective);
  const tolerance = Math.max(PRICE_TOLERANCE_ABS, effective * PRICE_TOLERANCE_REL);
  return delta <= tolerance;
}

// Compute the lines and price impact for a set of items without mutating anything.
// Returns a plan that can be committed atomically after charge succeeds.
function planLines(
  orderId: string,
  items: PlaceOrderItem[],
  crash: ActiveCrashView,
): { ok: true; plan: LinePlan } | { ok: false; reason: string } {
  const ts = Date.now();
  const tsIso = new Date(ts).toISOString();
  const settings = store.settings;
  const planLinesArr: PricedLine[] = [];
  let subtotalDelta = 0;

  // Track running new prices per drink for orders with multiple lines of the same drink.
  const runningPrice = new Map<string, number>();

  for (const item of items) {
    const drink = store.drinks.get(item.drinkId);
    if (!drink) return { ok: false, reason: `Unknown drink ${item.drinkId}` };
    if (!drink.isActive) return { ok: false, reason: `${drink.name} is off the menu` };
    if (item.quantity <= 0 || !Number.isFinite(item.quantity) || !Number.isInteger(item.quantity)) {
      return { ok: false, reason: `Bad quantity for ${drink.name}` };
    }
    if (item.quantity > 99) return { ok: false, reason: `Quantity exceeds 99 for ${drink.name}` };

    const market = drink.currentPrice;
    const effective = roundCurrency(effectiveDisplayPrice(drink, crash));

    let unit: number;
    if (typeof item.expectedUnitPrice === "number") {
      if (!Number.isFinite(item.expectedUnitPrice) || item.expectedUnitPrice <= 0) {
        return { ok: false, reason: `Bad expected price for ${drink.name}` };
      }
      if (!priceWithinTolerance(item.expectedUnitPrice, effective)) {
        return {
          ok: false,
          reason: `${drink.name} price moved (quoted $${item.expectedUnitPrice.toFixed(2)}, now $${effective.toFixed(2)}). Re-quote the customer.`,
        };
      }
      unit = roundCurrency(item.expectedUnitPrice);
    } else {
      unit = effective;
    }

    const lineTotal = roundCurrency(unit * item.quantity);
    const line: OrderLine = {
      id: ulid(),
      orderId,
      drinkId: drink.id,
      drinkNameSnapshot: drink.name,
      basePriceSnapshot: drink.basePrice,
      pricePaid: unit,
      marketPriceAtPurchase: market,
      quantity: item.quantity,
      lineTotal,
      createdAt: tsIso,
    };

    let newPrice = drink.currentPrice;
    if (drink.isDynamic) {
      const base = runningPrice.get(drink.id) ?? drink.currentPrice;
      const impact = (1 + settings.volatility) ** item.quantity;
      newPrice = roundCurrency(
        Math.min(base * impact, drink.basePrice * drink.maxPriceMultiplier),
      );
      runningPrice.set(drink.id, newPrice);
    }

    planLinesArr.push({ line, drink, newPrice });
    subtotalDelta = roundCurrency(subtotalDelta + lineTotal);
  }

  return { ok: true, plan: { lines: planLinesArr, subtotalDelta } };
}

function commitPlan(order: Order, plan: LinePlan, staffId: string): void {
  const ts = Date.now();
  const tsIso = new Date(ts).toISOString();
  const priceUpdates: { drinkId: string; currentPrice: number; ts: number }[] = [];

  for (const pl of plan.lines) {
    order.lines.push(pl.line);
    if (pl.drink.isDynamic && pl.newPrice !== pl.drink.currentPrice) {
      pl.drink.currentPrice = pl.newPrice;
      pl.drink.updatedAt = tsIso;
      pushHistory(pl.drink.id, ts, pl.newPrice);
    }
    if (pl.drink.isDynamic) {
      priceUpdates.push({ drinkId: pl.drink.id, currentPrice: pl.drink.currentPrice, ts });
    }
  }
  order.subtotal = roundCurrency(order.subtotal + plan.subtotalDelta);
  recordAudit(staffId, "order.lines.add", {
    orderId: order.id,
    itemCount: plan.lines.length,
    subtotalNow: order.subtotal,
  });
  if (priceUpdates.length) {
    broadcast({ type: "price.update", payload: priceUpdates });
  }
}

function newOrderShell(input: PlaceOrderInput): Order {
  const tsIso = nowIso();
  return {
    id: ulid(),
    orderNumber: store.nextOrderNumber++,
    shiftId: store.shiftId,
    staffId: input.staffId,
    status: "open",
    subtotal: 0,
    gstAmount: 0,
    total: 0,
    cashAdjustment: 0,
    crashEventId: null,
    crashDiscount: 0,
    paymentMethod: input.paymentMethod,
    paidAt: null,
    voidedAt: null,
    voidReason: null,
    refundedAt: null,
    refundAmount: 0,
    notes: input.notes ?? null,
    idCheck: input.idCheck ?? false,
    idempotencyKey: input.idempotencyKey ?? null,
    paymentChargeId: null,
    cashTendered: null,
    barAcked: false,
    barAckedAt: null,
    barAckedBy: null,
    createdAt: tsIso,
    lines: [],
  };
}

export function openTab(staffId: string, tabName: string, idCheck = false): Order {
  const tsIso = nowIso();
  const order: Order = {
    id: ulid(),
    orderNumber: store.nextOrderNumber++,
    shiftId: store.shiftId,
    staffId,
    status: "open",
    subtotal: 0,
    gstAmount: 0,
    total: 0,
    cashAdjustment: 0,
    crashEventId: null,
    crashDiscount: 0,
    paymentMethod: "card",
    paidAt: null,
    voidedAt: null,
    voidReason: null,
    refundedAt: null,
    refundAmount: 0,
    notes: tabName,
    idCheck,
    idempotencyKey: null,
    paymentChargeId: null,
    cashTendered: null,
    barAcked: false,
    barAckedAt: null,
    barAckedBy: null,
    createdAt: tsIso,
    lines: [],
  };
  store.orders.unshift(order);
  recordAudit(staffId, "tab.open", { orderId: order.id, tabName, idCheck });
  return order;
}

export function addToTab(
  tabId: string,
  staffId: string,
  items: PlaceOrderItem[],
): PlaceOrderResult {
  const o = store.orders.find((x) => x.id === tabId);
  if (!o) return { ok: false, reason: "Tab not found" };
  if (o.status !== "open") return { ok: false, reason: "Tab is not open" };
  const planResult = planLines(o.id, items, getActiveCrash());
  if (!planResult.ok) return planResult;
  commitPlan(o, planResult.plan, staffId);
  o.gstAmount = roundCurrency(o.subtotal - o.subtotal / (1 + store.settings.gstRate));
  o.total = o.subtotal;
  return { ok: true, order: o };
}

export function listOpenTabs(): Order[] {
  return store.orders.filter((o) => o.status === "open" && o.shiftId === store.shiftId);
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  pruneIdempotency();
  if (input.idempotencyKey) {
    const seen = store.idempotency.get(input.idempotencyKey);
    if (seen) {
      const existing = store.orders.find((o) => o.id === seen.orderId);
      if (existing) return { ok: true, order: existing };
    }
  }

  const { settings } = store;
  if (!isWithinTradingHours(settings.tradingOpen, settings.tradingClose)) {
    return { ok: false, reason: "Outside trading hours" };
  }
  if (!input.items.length && !input.tabId) return { ok: false, reason: "Empty order" };

  // 1. Resolve the order shell (new or existing tab) without committing it yet.
  let order: Order;
  let isNewOrder = false;
  if (input.tabId) {
    const existing = store.orders.find((x) => x.id === input.tabId);
    if (!existing) return { ok: false, reason: "Tab not found" };
    if (existing.status !== "open") return { ok: false, reason: "Tab already closed" };
    order = existing;
  } else {
    order = newOrderShell(input);
    isNewOrder = true;
  }

  // 2. Plan lines for new items (no mutation yet).
  const crash = getActiveCrash();
  let plan: LinePlan | null = null;
  if (input.items.length) {
    const planResult = planLines(order.id, input.items, crash);
    if (!planResult.ok) {
      // Roll back the orderNumber bump on a fresh order so we don't waste numbers.
      if (isNewOrder) store.nextOrderNumber -= 1;
      return planResult;
    }
    plan = planResult.plan;
  }

  // 3. Compute final totals (preview - not committed).
  const previewSubtotal = roundCurrency(order.subtotal + (plan?.subtotalDelta ?? 0));
  const previewGst = roundCurrency(
    previewSubtotal - previewSubtotal / (1 + settings.gstRate),
  );
  let previewTotal = previewSubtotal;
  let previewCashAdjustment = 0;
  if (input.paymentMethod === "cash") {
    previewTotal = roundCashAud(previewSubtotal);
    previewCashAdjustment = roundCurrency(previewTotal - previewSubtotal);
  }

  // 4. Charge BEFORE committing line mutations or price impact.
  const provider = getPaymentProvider();
  const charge = await provider.chargeAmount(
    order.id,
    Math.round(previewTotal * 100),
    "default",
  );
  if (!charge.ok) {
    if (isNewOrder) store.nextOrderNumber -= 1;
    return { ok: false, reason: charge.reason ?? "Payment failed" };
  }

  // 5. Charge succeeded -- commit.
  if (isNewOrder) {
    store.orders.unshift(order);
    if (store.orders.length > 5000) store.orders.length = 5000;
  }
  if (plan) {
    commitPlan(order, plan, input.staffId);
  }
  order.subtotal = previewSubtotal;
  order.gstAmount = previewGst;
  order.total = previewTotal;
  order.cashAdjustment = previewCashAdjustment;
  order.paymentMethod = input.paymentMethod;
  order.paymentChargeId = charge.chargeId;
  order.status = "paid";
  order.paidAt = nowIso();
  order.crashEventId = crash.active && crash.event ? crash.event.id : null;
  order.crashDiscount = crash.active && crash.event ? crash.event.discountPercent : 0;
  if (input.paymentMethod === "cash" && typeof input.cashTendered === "number") {
    order.cashTendered = roundCurrency(input.cashTendered);
  }

  if (crash.active && crash.event) {
    crash.event.totalOrdersDuringCrash += 1;
    crash.event.totalRevenueDuringCrash = roundCurrency(
      crash.event.totalRevenueDuringCrash + order.total,
    );
  }

  recordAudit(input.staffId, "order.placed", {
    orderId: order.id,
    orderNumber: order.orderNumber,
    total: order.total,
    cashAdjustment: order.cashAdjustment,
    cashTendered: order.cashTendered,
    chargeId: charge.chargeId,
    provider: charge.provider,
    idCheck: order.idCheck,
  });

  rememberSale(order);

  broadcast({
    type: "order.placed",
    payload: {
      id: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      lineCount: order.lines.length,
      ts: order.createdAt,
    },
  });

  if (input.idempotencyKey) {
    store.idempotency.set(input.idempotencyKey, { orderId: order.id, ts: Date.now() });
  }

  void persistOrder(order).catch((err) => {
    console.error("[persist] order failed", err);
  });

  if (input.receipt) {
    const r = getReceiptProvider();
    await r.send(order, { channel: input.receipt.channel, to: input.receipt.to });
  }

  return { ok: true, order };
}

export function shiftSummary() {
  const orders = store.orders.filter((o) => o.shiftId === store.shiftId && o.status === "paid");
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const drinksSold = orders.reduce((s, o) => s + o.lines.reduce((q, l) => q + l.quantity, 0), 0);
  const gst = orders.reduce((s, o) => s + o.gstAmount, 0);
  return {
    shiftId: store.shiftId,
    orders: orders.length,
    revenue: roundCurrency(revenue),
    gst: roundCurrency(gst),
    drinksSold,
    crashes: store.crashHistory.length,
  };
}

export function setBarAck(
  orderId: string,
  acked: boolean,
  actor: string,
): { ok: true; order: Order } | { ok: false; reason: string } {
  const o = store.orders.find((x) => x.id === orderId);
  if (!o) return { ok: false, reason: "Order not found" };
  if (o.status !== "paid") return { ok: false, reason: "Only paid orders can be acked" };
  o.barAcked = acked;
  o.barAckedAt = acked ? nowIso() : null;
  o.barAckedBy = acked ? actor : null;
  recordAudit(actor, acked ? "order.bar.ack" : "order.bar.unack", { orderId });
  broadcast({
    type: "order.updated",
    payload: { id: o.id, barAcked: o.barAcked, status: o.status },
  });
  return { ok: true, order: o };
}
