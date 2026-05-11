import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const order = store.orders.find((o) => o.id === id);
  if (!order) return NextResponse.json({ ok: false, reason: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, order });
}
