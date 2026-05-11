import { ulid } from "ulid";
import { broadcast, pushHistory, recordAudit, store } from "../store";
import type { Order, OrderLine } from "../types";
import { roundCurrency } from "../money";
import { nowIso, isWithinTradingHours } from "../time";
import { effectiveDisplayPrice, getActiveCrash } from "./crash";
import { getPaymentProvider } from "../providers/payment";
import { getReceiptProvider } from "../providers/receipt";

export interface PlaceOrderInput {
  staffId: string;
  paymentMethod: Order["paymentMethod"];
  notes?: string;
  items: { drinkId: string; quantity: number }[];
  tabName?: string;
  tabId?: string;
  receipt?: { channel: "email" | "sms"; to: string };
  idempotencyKey?: string;
}

export type PlaceOrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: string };

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

export function openTab(staffId: string, tabName: string): Order {
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
    crashEventId: null,
    crashDiscount: 0,
    paymentMethod: "card",
    paidAt: null,
    voidedAt: null,
    voidReason: null,
    refundedAt: null,
    refundAmount: 0,
    notes: tabName,
    createdAt: tsIso,
    lines: [],
  };
  store.orders.unshift(order);
  recordAudit(staffId, "tab.open", { orderId: order.id, tabName });
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
      crashEventId: null,
      crashDiscount: 0,
      paymentMethod: input.paymentMethod,
      paidAt: null,
      voidedAt: null,
      voidReason: null,
      refundedAt: null,
      refundAmount: 0,
      notes: input.notes ?? null,
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

  // Lock-in: at charge time, snapshot the live crash so the order pays the
  // displayed price even if the crash ends mid-charge.
  const crashNow = getActiveCrash();
  order.paymentMethod = input.paymentMethod;
  order.crashEventId = crashNow.active && crashNow.event ? crashNow.event.id : null;
  order.crashDiscount = crashNow.active && crashNow.event ? crashNow.event.discountPercent : 0;

  const provider = getPaymentProvider();
  const charge = await provider.chargeAmount(order.id, Math.round(order.total * 100), "default");
  if (!charge.ok) {
    return { ok: false, reason: charge.reason ?? "Payment failed" };
  }

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
    chargeId: charge.chargeId,
    provider: charge.provider,
  });

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
