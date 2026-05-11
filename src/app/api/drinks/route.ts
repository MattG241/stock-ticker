import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { z } from "zod";
import { broadcast, recordAudit, store } from "@/lib/store";
import { nowIso } from "@/lib/time";

const patchSchema = z.object({
  id: z.string().min(1),
  basePrice: z.number().positive().optional(),
  currentPrice: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),
  isDynamic: z.boolean().optional(),
  isActive: z.boolean().optional(),
  minPriceMultiplier: z.number().positive().optional(),
  maxPriceMultiplier: z.number().positive().optional(),
  name: z.string().min(1).optional(),
  emoji: z.string().min(1).max(4).optional(),
  sortOrder: z.number().int().optional(),
});

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ drinks: [...store.drinks.values()] });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
  }
  const d = store.drinks.get(parsed.data.id);
  if (!d) return NextResponse.json({ ok: false, reason: "Unknown drink" }, { status: 404 });
  const before = { ...d };
  Object.assign(d, parsed.data, { updatedAt: nowIso() });
  recordAudit("admin", "drink.update", { id: d.id, before, after: { ...d } });
  broadcast({ type: "drink.updated", payload: d });
  return NextResponse.json({ ok: true, drink: d });
}
