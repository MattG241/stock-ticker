import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { z } from "zod";
import { placeOrder } from "@/lib/engine/orders";
import { store } from "@/lib/store";

const schema = z.object({
  staffId: z.string().min(1),
  paymentMethod: z.enum(["card", "cash", "split"]),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        drinkId: z.string().min(1),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .default([]),
  tabId: z.string().optional(),
  receipt: z
    .object({ channel: z.enum(["email", "sms"]), to: z.string().min(1) })
    .optional(),
  idempotencyKey: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
  }
  const result = await placeOrder(parsed.data);
  if (!result.ok) return NextResponse.json(result, { status: 422 });
  return NextResponse.json({ ok: true, order: result.order });
}

export function GET() {
  return NextResponse.json({ orders: store.orders.slice(0, 50) });
}
