import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { closeShift } from "@/lib/engine/shift";
import { getReceiptProvider } from "@/lib/providers/receipt";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const closer = typeof body?.closedBy === "string" ? body.closedBy : "admin";
  const result = closeShift(closer);
  if (!result) return NextResponse.json({ ok: false, reason: "No open shift" }, { status: 422 });
  // Fire-and-forget receipt of the Z-report to ownership. Console provider just logs.
  const recipient = typeof body?.email === "string" ? body.email : "owner@thedrinkexchange.com.au";
  const provider = getReceiptProvider();
  provider
    .send(
      {
        id: result.shift.id,
        orderNumber: 0,
        shiftId: result.shift.id,
        staffId: closer,
        status: "paid",
        subtotal: result.zReport.revenue,
        gstAmount: result.zReport.gst,
        total: result.zReport.revenue,
        cashAdjustment: 0,
        crashEventId: null,
        crashDiscount: 0,
        paymentMethod: "card",
        paidAt: result.shift.closedAt,
        voidedAt: null,
        voidReason: null,
        refundedAt: null,
        refundAmount: 0,
        notes: "Z-REPORT",
        idCheck: false,
        idempotencyKey: null,
        paymentChargeId: null,
        createdAt: result.shift.openedAt,
        lines: [],
      },
      { channel: "email", to: recipient },
    )
    .catch(() => {});
  return NextResponse.json({ ok: true, shift: result.shift, zReport: result.zReport });
}
