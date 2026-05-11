import { recordAudit, store } from "../store";
import { roundCurrency } from "../money";
import { nowIso } from "../time";
import type { Order } from "../types";
import { getPaymentProvider } from "../providers/payment";

export async function voidOrder(
  orderId: string,
  actor: string,
  reason: string,
): Promise<{ ok: true; order: Order } | { ok: false; reason: string }> {
  const o = store.orders.find((x) => x.id === orderId);
  if (!o) return { ok: false, reason: "Order not found" };
  if (o.status === "voided") return { ok: false, reason: "Already voided" };
  if (o.status === "refunded") return { ok: false, reason: "Already refunded" };
  o.status = "voided";
  o.voidedAt = nowIso();
  o.voidReason = reason;
  recordAudit(actor, "order.void", { orderId, reason, total: o.total });
  return { ok: true, order: o };
}

export async function refundOrder(
  orderId: string,
  actor: string,
  amount: number,
): Promise<{ ok: true; order: Order } | { ok: false; reason: string }> {
  const o = store.orders.find((x) => x.id === orderId);
  if (!o) return { ok: false, reason: "Order not found" };
  if (o.status !== "paid") return { ok: false, reason: "Only paid orders can be refunded" };
  if (amount <= 0 || amount > o.total) return { ok: false, reason: "Refund amount out of range" };
  const refundCents = Math.round(amount * 100);
  const provider = getPaymentProvider();
  const result = await provider.refundCharge(`order:${o.id}`, refundCents);
  if (!result.ok) {
    return { ok: false, reason: result.reason ?? "Refund failed" };
  }
  o.status = "refunded";
  o.refundedAt = nowIso();
  o.refundAmount = roundCurrency(amount);
  recordAudit(actor, "order.refund", { orderId, amount: o.refundAmount, providerRefundId: result.refundId });
  return { ok: true, order: o };
}
