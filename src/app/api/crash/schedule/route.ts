import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelSchedule, listSchedules, scheduleCrash } from "@/lib/engine/schedule";

const schema = z.object({
  fireAt: z.string().datetime(),
  discountPercent: z.number().min(0.05).max(0.9),
  durationSeconds: z.number().int().min(10).max(600),
  label: z.string().max(80).optional(),
});

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ schedules: listSchedules() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
  const sc = scheduleCrash(parsed.data);
  return NextResponse.json({ ok: true, schedule: sc });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, reason: "id required" }, { status: 400 });
  const ok = cancelSchedule(id);
  return NextResponse.json({ ok });
}
