import { store } from "../store";

function csvEscape(v: string | number): string {
  const s = String(v);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function basCsv(fromIso?: string, toIso?: string): string {
  const from = fromIso ? new Date(fromIso).getTime() : 0;
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  const rows: string[] = [
    [
      "order_id",
      "order_number",
      "shift_id",
      "created_at",
      "status",
      "payment_method",
      "subtotal_ex_gst",
      "gst",
      "total_inc_gst",
      "refund_amount",
    ].join(","),
  ];
  for (const o of store.orders) {
    const ts = new Date(o.createdAt).getTime();
    if (ts < from || ts > to) continue;
    const ex = Math.round((o.total - o.gstAmount) * 100) / 100;
    rows.push(
      [
        csvEscape(o.id),
        o.orderNumber,
        csvEscape(o.shiftId),
        o.createdAt,
        o.status,
        o.paymentMethod,
        ex.toFixed(2),
        o.gstAmount.toFixed(2),
        o.total.toFixed(2),
        o.refundAmount.toFixed(2),
      ].join(","),
    );
  }
  return rows.join("\n");
}
