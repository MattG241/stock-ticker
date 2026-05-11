import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { getReceiptProvider } from "@/lib/providers/receipt";
import { recordAudit } from "@/lib/store";

const schema = z.object({
  channel: z.enum(["email", "sms"]),
  to: z.string().min(3).max(200),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
  }
  const order = store.orders.find((o) => o.id === id);
  if (!order) return NextResponse.json({ ok: false, reason: "Order not found" }, { status: 404 });
  if (order.status !== "paid") {
    return NextResponse.json(
      { ok: false, reason: "Only paid orders can have receipts sent" },
      { status: 422 },
    );
  }
  const provider = getReceiptProvider();
  const result = await provider.send(order, parsed.data);
  recordAudit("customer", "receipt.send", {
    orderId: id,
    channel: parsed.data.channel,
    to: parsed.data.to,
    ok: result.ok,
    provider: provider.name,
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason ?? "Receipt provider failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
