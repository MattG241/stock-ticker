import { ulid } from "ulid";
import { recordAudit, store } from "../store";
import { nowIso } from "../time";
import { roundCurrency } from "../money";
import type { Shift, ZReport } from "../types";

export function currentShift(): Shift | null {
  return store.shifts.find((s) => s.id === store.shiftId) ?? null;
}

export function openShift(openedBy: string): Shift {
  // If the previous shift is still open, close it implicitly.
  const prev = currentShift();
  if (prev && !prev.closedAt) {
    closeShift(openedBy);
  }
  const id = `shift-${Date.now()}-${ulid().slice(-6)}`;
  const shift: Shift = {
    id,
    openedAt: nowIso(),
    closedAt: null,
    openedBy,
    closedBy: null,
  };
  store.shifts.unshift(shift);
  store.shiftId = id;
  store.nextOrderNumber = 1;
  recordAudit(openedBy, "shift.open", { shiftId: id });
  return shift;
}

export function closeShift(closedBy: string): { shift: Shift; zReport: ZReport } | null {
  const shift = currentShift();
  if (!shift || shift.closedAt) return null;
  const zReport = buildZReport(shift);
  shift.closedAt = nowIso();
  shift.closedBy = closedBy;
  shift.zReport = zReport;
  recordAudit(closedBy, "shift.close", { shiftId: shift.id, revenue: zReport.revenue });
  return { shift, zReport };
}

export function buildZReport(shift: Shift): ZReport {
  const orders = store.orders.filter((o) => o.shiftId === shift.id);
  const paid = orders.filter((o) => o.status === "paid");
  let revenue = 0;
  let gst = 0;
  let cogs = 0;
  let crashRevenue = 0;
  let voids = 0;
  let refunds = 0;
  const drinkCounts: ZReport["drinkCounts"] = {};
  const paymentBreakdown: ZReport["paymentBreakdown"] = {};

  for (const o of orders) {
    if (o.status === "voided") voids += 1;
    if (o.status === "refunded") {
      refunds += 1;
      revenue -= o.refundAmount;
    }
    if (o.status !== "paid") continue;
    revenue += o.total;
    gst += o.gstAmount;
    if (o.crashEventId) crashRevenue += o.total;
    paymentBreakdown[o.paymentMethod] ??= { count: 0, total: 0 };
    paymentBreakdown[o.paymentMethod].count += 1;
    paymentBreakdown[o.paymentMethod].total = roundCurrency(
      paymentBreakdown[o.paymentMethod].total + o.total,
    );
    for (const l of o.lines) {
      const d = store.drinks.get(l.drinkId);
      cogs += (d?.costPrice ?? 0) * l.quantity;
      const key = l.drinkId;
      drinkCounts[key] ??= { name: l.drinkNameSnapshot, count: 0, revenue: 0 };
      drinkCounts[key].count += l.quantity;
      drinkCounts[key].revenue = roundCurrency(drinkCounts[key].revenue + l.lineTotal);
    }
  }

  const crashesInShift = store.crashHistory.filter(
    (c) =>
      new Date(c.startedAt).getTime() >= new Date(shift.openedAt).getTime() &&
      (!shift.closedAt || new Date(c.startedAt).getTime() <= new Date(shift.closedAt).getTime()),
  );

  return {
    shiftId: shift.id,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt ?? nowIso(),
    orders: paid.length,
    revenue: roundCurrency(revenue),
    gst: roundCurrency(gst),
    subtotalExGst: roundCurrency(revenue - gst),
    cogsEstimate: roundCurrency(cogs),
    drinkCounts,
    crashCount: crashesInShift.length,
    crashRevenue: roundCurrency(crashRevenue),
    voids,
    refunds,
    paymentBreakdown,
  };
}

export function renderZReportText(z: ZReport): string {
  const lines = [
    "Z-REPORT",
    `Shift:        ${z.shiftId}`,
    `Opened:       ${new Date(z.openedAt).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })}`,
    `Closed:       ${new Date(z.closedAt).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })}`,
    "",
    `Orders:       ${z.orders}`,
    `Revenue:      $${z.revenue.toFixed(2)}  (ex-GST $${z.subtotalExGst.toFixed(2)}, GST $${z.gst.toFixed(2)})`,
    `COGS (est):   $${z.cogsEstimate.toFixed(2)}`,
    `Crash count:  ${z.crashCount}`,
    `Crash rev:    $${z.crashRevenue.toFixed(2)}`,
    `Voids:        ${z.voids}`,
    `Refunds:      ${z.refunds}`,
    "",
    "Payment breakdown:",
    ...Object.entries(z.paymentBreakdown).map(
      ([k, v]) => `  ${k.padEnd(10)} ${v.count.toString().padStart(4)}  $${v.total.toFixed(2)}`,
    ),
    "",
    "Top drinks:",
    ...Object.values(z.drinkCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map((d) => `  ${d.name.padEnd(22)} ${d.count.toString().padStart(4)}  $${d.revenue.toFixed(2)}`),
  ];
  return lines.join("\n");
}
