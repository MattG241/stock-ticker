import { ulid } from "ulid";
import { broadcast, pushHistory, recordAudit, store } from "../store";
import type { Order, OrderLine } from "../types";
import { roundCashAud, roundCurrency } from "../money";
import { nowIso, isWithinTradingHours } from "../time";
import { effectiveDisplayPrice, getActiveCrash } from "./crash";
import { getPaymentProvider } from "../providers/payment";
import { getReceiptProvider } from "../providers/receipt";
import { persistOrder } from "../db/repos";

const IDEMPOTENCY_TTL_MS = 5 * 60_000;
const RECENT_SALES_CAP = 12;

export interface PlaceOrderInput {
  staffId: string;
  paymentMethod: Order["paymentMethod"];
  notes?: string;
  items: { drinkId: string; quantity: number }[];
  tabId?: string;
  receipt?: { channel: "email" | "sms"; to: string };
  idempotencyKey?: string;
  idCheck?: boolean;
}

export type PlaceOrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: string };

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

function applyOrderImpactAndLines(
  order: Order,
  items: { drinkId: string; quantity: number }[],
  staffId: string,
): PlaceOrderResult {
  const crash = getActiveCrash();
  const ts = Date.now();
  const tsIso = new Date(ts).toISOString();
  const settings = store.settings;
  const priceUpdates: { drinkId: string; currentPrice: number; ts: number }[] = [];

  for (const item of items) {
    const drink = store.drinks.get(item.drinkId);
    if (!drink) return { ok: false, reason: `Unknown drink ${item.drinkId}` };
    if (!drink.isActive) return { ok: false, reason: `${drink.name} is off the menu` };
    if (item.quantity <= 0 || !Number.isFinite(item.quantity)) {
      return { ok: false, reason: `Bad quantity for ${drink.name}` };
    }
    const market = drink.currentPrice;
    const unit = roundCurrency(effectiveDisplayPrice(drink, crash));
    const lineTotal = roundCurrency(unit * item.quantity);
    const line: OrderLine = {
      id: ulid(),
      orderId: order.id,
      drinkId: drink.id,
      drinkNameSnapshot: drink.name,
      basePriceSnapshot: drink.basePrice,
      pricePaid: unit,
      marketPriceAtPurchase: market,
      quantity: item.quantity,
      lineTotal,
      createdAt: tsIso,
    };
    order.lines.push(line);
    order.subtotal = roundCurrency(order.subtotal + lineTotal);

    if (drink.isDynamic) {
      const impact = (1 + settings.volatility) ** item.quantity;
      const bumped = Math.min(
        drink.currentPrice * impact,
        drink.basePrice * drink.maxPriceMultiplier,
      );
      drink.currentPrice = roundCurrency(bumped);
      drink.updatedAt = tsIso;
      pushHistory(drink.id, ts, drink.currentPrice);
      priceUpdates.push({ drinkId: drink.id, currentPrice: drink.currentPrice, ts });
    }
  }

  order.gstAmount = roundCurrency(order.subtotal - order.subtotal / (1 + settings.gstRate));
  order.total = order.subtotal;
  recordAudit(staffId, "order.lines.add", {
    orderId: order.id,
    items,
    subtotalNow: order.subtotal,
  });
  if (priceUpdates.length) {
    broadcast({ type: "price.update", payload: priceUpdates });
  }
  return { ok: true, order };
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
    createdAt: tsIso,
    lines: [],
  };
  store.orders.unshift(order);
  recordAudit(staffId, "tab.open", { orderId: order.id, tabName, idCheck });
  return order;
}

export function addToTab(tabId: string, staffId: string, items: PlaceOrderInput["items"]): PlaceOrderResult {
  const o = store.orders.find((x) => x.id === tabId);
  if (!o) return { ok: false, reason: "Tab not found" };
  if (o.status !== "open") return { ok: false, reason: "Tab is not open" };
  return applyOrderImpactAndLines(o, items, staffId);
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

  let order: Order;
  if (input.tabId) {
    const existing = store.orders.find((x) => x.id === input.tabId);
    if (!existing) return { ok: false, reason: "Tab not found" };
    if (existing.status !== "open") return { ok: false, reason: "Tab already closed" };
    order = existing;
    if (input.items.length) {
      const added = applyOrderImpactAndLines(order, input.items, input.staffId);
      if (!added.ok) return added;
    }
  } else {
    const tsIso = nowIso();
    order = {
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
      createdAt: tsIso,
      lines: [],
    };
    store.orders.unshift(order);
    if (store.orders.length > 5000) store.orders.length = 5000;
    const added = applyOrderImpactAndLines(order, input.items, input.staffId);
    if (!added.ok) {
      store.orders = store.orders.filter((x) => x.id !== order.id);
      return added;
    }
  }

  // Cash rounding to 5c (AU). Card payments are exact.
  if (input.paymentMethod === "cash") {
    const rounded = roundCashAud(order.subtotal);
    order.cashAdjustment = roundCurrency(rounded - order.subtotal);
    order.total = rounded;
  } else {
    order.total = order.subtotal;
    order.cashAdjustment = 0;
  }

  const crashNow = getActiveCrash();
  order.paymentMethod = input.paymentMethod;
  order.crashEventId = crashNow.active && crashNow.event ? crashNow.event.id : null;
  order.crashDiscount = crashNow.active && crashNow.event ? crashNow.event.discountPercent : 0;

  const provider = getPaymentProvider();
  const charge = await provider.chargeAmount(order.id, Math.round(order.total * 100), "default");
  if (!charge.ok) {
    return { ok: false, reason: charge.reason ?? "Payment failed" };
  }
  order.paymentChargeId = charge.chargeId;
  order.status = "paid";
  order.paidAt = nowIso();

  if (crashNow.active && crashNow.event) {
    crashNow.event.totalOrdersDuringCrash += 1;
    crashNow.event.totalRevenueDuringCrash = roundCurrency(
      crashNow.event.totalRevenueDuringCrash + order.total,
    );
  }

  recordAudit(input.staffId, "order.placed", {
    orderId: order.id,
    orderNumber: order.orderNumber,
    total: order.total,
    cashAdjustment: order.cashAdjustment,
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

  // Async write-through to Postgres if DATABASE_URL is set.
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
