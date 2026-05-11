import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findStaffByPin } from "@/lib/engine/staff";
import { listRefusals, recordRefusal } from "@/lib/engine/refusal";

const schema = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
  reason: z.enum(["intoxication", "id", "behaviour", "other"]),
  notes: z.string().min(1).max(280),
});

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ refusals: listRefusals() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
  const staff = findStaffByPin(parsed.data.pin);
  if (!staff) return NextResponse.json({ ok: false, reason: "PIN required" }, { status: 401 });
  const entry = recordRefusal({
    staffId: staff.id,
    reason: parsed.data.reason,
    notes: parsed.data.notes,
  });
  return NextResponse.json({ ok: true, entry });
}
