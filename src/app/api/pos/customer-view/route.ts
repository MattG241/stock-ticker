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

const statusEnum = z.enum([
  "idle",
  "building",
  "awaiting-customer-tip",
  "customer-tip-confirmed",
  "awaiting-card-tap",
  "customer-card-tapped",
  "awaiting-cash-tender",
  "processing",
  "paid",
  "failed",
]);

// All fields optional - this endpoint accepts partial updates (e.g. customer
// screen only sends { status, tipAmount }).
const partialSchema = z.object({
  lines: z.array(lineSchema).optional(),
  subtotal: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  discountReason: z.string().nullable().optional(),
  tipAmount: z.number().nonnegative().optional(),
  cashAdjustment: z.number().optional(),
  total: z.number().nonnegative().optional(),
  paymentMethod: z.enum(["card", "cash"]).nullable().optional(),
  cashTendered: z.number().nullable().optional(),
  changeDue: z.number().nullable().optional(),
  status: statusEnum.optional(),
  lastOrderId: z.string().nullable().optional(),
  lastOrderNumber: z.number().nullable().optional(),
  lastReceiptUrl: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  receiptSent: z.boolean().optional(),
});

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ view: store.customerView ?? emptyCustomerView() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (body && body.command === "reset") {
    store.customerView = emptyCustomerView();
    broadcast({ type: "customer.view.updated", payload: store.customerView });
    return NextResponse.json({ ok: true, view: store.customerView });
  }
  const parsed = partialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
  }
  const cur = store.customerView ?? emptyCustomerView();
  store.customerView = { ...cur, ...parsed.data, updatedAt: nowIso() };
  broadcast({ type: "customer.view.updated", payload: store.customerView });
  return NextResponse.json({ ok: true, view: store.customerView });
}
