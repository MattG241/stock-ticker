import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { z } from "zod";
import { broadcast, store } from "@/lib/store";
import { nowIso } from "@/lib/time";
import { emptyCustomerView } from "@/lib/store";

const lineSchema = z.object({
  drinkId: z.string().min(1),
  ticker: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
  locked: z.boolean().default(true),
});

const schema = z.object({
  lines: z.array(lineSchema).default([]),
  subtotal: z.number().nonnegative().default(0),
  discountAmount: z.number().nonnegative().default(0),
  discountReason: z.string().nullable().default(null),
  tipAmount: z.number().nonnegative().default(0),
  cashAdjustment: z.number().default(0),
  total: z.number().nonnegative().default(0),
  paymentMethod: z.enum(["card", "cash"]).nullable().default(null),
  cashTendered: z.number().nullable().default(null),
  changeDue: z.number().nullable().default(null),
  status: z
    .enum([
      "idle",
      "building",
      "awaiting-tip",
      "awaiting-cash",
      "processing",
      "paid",
      "failed",
    ])
    .default("building"),
  lastOrderNumber: z.number().nullable().default(null),
  lastReceiptUrl: z.string().nullable().default(null),
});

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ view: store.customerView ?? emptyCustomerView() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  // Special command: reset.
  if (body && body.command === "reset") {
    store.customerView = emptyCustomerView();
    broadcast({ type: "customer.view.updated", payload: store.customerView });
    return NextResponse.json({ ok: true, view: store.customerView });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
  }
  store.customerView = { ...parsed.data, updatedAt: nowIso() };
  broadcast({ type: "customer.view.updated", payload: store.customerView });
  return NextResponse.json({ ok: true, view: store.customerView });
}
