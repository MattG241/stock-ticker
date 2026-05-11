import { getDb, schema } from "./index";
import type { AuditEntry, Order, RefusalEntry, Shift } from "../types";

/**
 * Lightweight write-through to Postgres. The in-memory store remains the
 * source of truth for hot reads (every SSE client subscribes to it), while
 * Postgres is the durable journal for orders, lines, audit, shifts, and
 * refusals. If DATABASE_URL is not set, all calls are no-ops.
 */

export async function persistOrder(order: Order): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .insert(schema.orders)
    .values({
      id: order.id,
      orderNumber: order.orderNumber,
      shiftId: order.shiftId,
      staffId: order.staffId,
      status: order.status,
      subtotal: order.subtotal.toFixed(2),
      gstAmount: order.gstAmount.toFixed(2),
      total: order.total.toFixed(2),
      crashEventId: order.crashEventId,
      crashDiscount: order.crashDiscount.toFixed(3),
      paymentMethod: order.paymentMethod,
      paidAt: order.paidAt ? new Date(order.paidAt) : null,
      voidedAt: order.voidedAt ? new Date(order.voidedAt) : null,
      voidReason: order.voidReason,
      refundedAt: order.refundedAt ? new Date(order.refundedAt) : null,
      refundAmount: order.refundAmount.toFixed(2),
      notes: order.notes,
      createdAt: new Date(order.createdAt),
    })
    .onConflictDoUpdate({
      target: schema.orders.id,
      set: {
        status: order.status,
        total: order.total.toFixed(2),
        paidAt: order.paidAt ? new Date(order.paidAt) : null,
        voidedAt: order.voidedAt ? new Date(order.voidedAt) : null,
        voidReason: order.voidReason,
        refundedAt: order.refundedAt ? new Date(order.refundedAt) : null,
        refundAmount: order.refundAmount.toFixed(2),
      },
    });
  if (order.lines.length) {
    await db
      .insert(schema.orderLines)
      .values(
        order.lines.map((l) => ({
          id: l.id,
          orderId: l.orderId,
          drinkId: l.drinkId,
          drinkNameSnapshot: l.drinkNameSnapshot,
          basePriceSnapshot: l.basePriceSnapshot.toFixed(2),
          pricePaid: l.pricePaid.toFixed(2),
          marketPriceAtPurchase: l.marketPriceAtPurchase.toFixed(2),
          quantity: l.quantity,
          lineTotal: l.lineTotal.toFixed(2),
          createdAt: new Date(l.createdAt),
        })),
      )
      .onConflictDoNothing();
  }
}

export async function persistAudit(entry: AuditEntry): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .insert(schema.auditLog)
    .values({
      id: entry.id,
      ts: new Date(entry.ts),
      actor: entry.actor,
      action: entry.action,
      detail: entry.detail,
    })
    .onConflictDoNothing();
}

export async function persistShift(shift: Shift): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .insert(schema.shifts)
    .values({
      id: shift.id,
      openedAt: new Date(shift.openedAt),
      closedAt: shift.closedAt ? new Date(shift.closedAt) : null,
      openedBy: shift.openedBy,
      closedBy: shift.closedBy,
    })
    .onConflictDoUpdate({
      target: schema.shifts.id,
      set: {
        closedAt: shift.closedAt ? new Date(shift.closedAt) : null,
        closedBy: shift.closedBy,
      },
    });
}

export async function persistRefusal(_r: RefusalEntry): Promise<void> {
  // The refusal table is not yet in the Drizzle schema; logged via audit
  // for now. Add a dedicated table here when expanding.
}
