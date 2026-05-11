import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { z } from "zod";
import { endCrash, getActiveCrash, startCrash } from "@/lib/engine/crash";
import { store } from "@/lib/store";

const startSchema = z.object({
  discountPercent: z.number().min(0.01).max(0.9),
  durationSeconds: z.number().int().min(10).max(600),
  triggeredBy: z.string().min(1).default("admin"),
});

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    current: getActiveCrash(),
    history: store.crashHistory.slice(0, 20),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
  }
  const result = startCrash(parsed.data);
  if (!result.ok) return NextResponse.json(result, { status: 422 });
  return NextResponse.json({ ok: true, event: result.event });
}

export async function DELETE() {
  endCrash(true, "admin");
  return NextResponse.json({ ok: true });
}
