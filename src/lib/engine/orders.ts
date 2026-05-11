import { ulid } from "ulid";
import { broadcast, pushHistory, recordAudit, store } from "../store";
import type { Order, OrderLine } from "../types";
import { roundCurrency } from "../money";
import { nowIso, isWithinTradingHours } from "../time";
import { effectiveDisplayPrice, getActiveCrash } from "./crash";

export interface PlaceOrderInput {
  staffId: string;
  paymentMethod: Order["paymentMethod"];
  notes?: string;
  items: { drinkId: string; quantity: number }[];
}

export type PlaceOrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: string };

export function placeOrder(input: PlaceOrderInput): PlaceOrderResult {
  const { settings } = store;
  if (!isWithinTradingHours(settings.tradingOpen, settings.tradingClose)) {
    return { ok: false, reason: "Outside trading hours" };
  }
  if (!input.items.length) return { ok: false, reason: "Empty order" };

  const crash = getActiveCrash();
  const ts = Date.now();
  const tsIso = nowIso();
  const lines: OrderLine[] = [];
  const priceUpdates: { drinkId: string; currentPrice: number; ts: number }[] = [];
  let subtotal = 0;

  for (const item of input.items) {
    const drink = store.drinks.get(item.drinkId);
    if (!drink) return { ok: false, reason: `Unknown drink ${item.drinkId}` };
    if (!drink.isActive) return { ok: false, reason: `${drink.name} is off the menu` };
    if (item.quantity <= 0 || !Number.isFinite(item.quantity)) {
      return { ok: false, reason: `Bad quantity for ${drink.name}` };
    }
    const market = drink.currentPrice;
    const unit = roundCurrency(effectiveDisplayPrice(drink, crash));
    const lineTotal = roundCurrency(unit * item.quantity);
    lines.push({
      id: ulid(),
      orderId: "pending",
      drinkId: drink.id,
      drinkNameSnapshot: drink.name,
      basePriceSnapshot: drink.basePrice,
      pricePaid: unit,
      marketPriceAtPurchase: market,
      quantity: item.quantity,
      lineTotal,
      createdAt: tsIso,
    });
    subtotal = roundCurrency(subtotal + lineTotal);

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

  const gst = roundCurrency(subtotal - subtotal / (1 + settings.gstRate));
  const orderId = ulid();
  for (const l of lines) l.orderId = orderId;

  const order: Order = {
    id: orderId,
    orderNumber: store.nextOrderNumber++,
    shiftId: store.shiftId,
    staffId: input.staffId,
    status: "paid",
    subtotal,
    gstAmount: gst,
    total: subtotal,
    crashEventId: crash.active ? crash.event!.id : null,
    crashDiscount: crash.active ? crash.event!.discountPercent : 0,
    paymentMethod: input.paymentMethod,
    paidAt: tsIso,
    voidedAt: null,
    voidReason: null,
    refundedAt: null,
    refundAmount: 0,
    notes: input.notes ?? null,
    createdAt: tsIso,
    lines,
  };
  store.orders.unshift(order);
  if (store.orders.length > 2000) store.orders.length = 2000;

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
  });

  if (priceUpdates.length) {
    broadcast({ type: "price.update", payload: priceUpdates });
  }
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
