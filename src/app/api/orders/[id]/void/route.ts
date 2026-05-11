import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { z } from "zod";
import { voidOrder } from "@/lib/engine/voids";
import { requireRole } from "@/lib/engine/staff";

const schema = z.object({
  pin: z.string().min(4).max(8),
  reason: z.string().min(1),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
  const actor = requireRole(parsed.data.pin, ["manager", "admin", "owner"]);
  if (!actor) return NextResponse.json({ ok: false, reason: "Manager PIN required" }, { status: 403 });
  const result = await voidOrder(id, actor.id, parsed.data.reason);
  if (!result.ok) return NextResponse.json(result, { status: 422 });
  return NextResponse.json({ ok: true, order: result.order });
}
