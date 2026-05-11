import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { z } from "zod";
import { broadcast, recordAudit, store } from "@/lib/store";

const schema = z
  .object({
    decayRate: z.number().min(0).max(1).optional(),
    noiseLevel: z.number().min(0).max(0.1).optional(),
    volatility: z.number().min(0).max(0.5).optional(),
    minMarginMultiplier: z.number().min(0).max(2).optional(),
    perShiftMaxDiscount: z.number().min(0).max(0.9).optional(),
    crashCooldownMs: z.number().int().min(0).optional(),
    tradingOpen: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    tradingClose: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })
  .strict();

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ settings: store.settings });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
  }
  const before = { ...store.settings };
  Object.assign(store.settings, parsed.data);
  recordAudit("admin", "settings.update", { before, after: { ...store.settings } });
  broadcast({ type: "settings.updated", payload: store.settings });
  return NextResponse.json({ ok: true, settings: store.settings });
}
