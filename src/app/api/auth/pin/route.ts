import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findStaffByPin } from "@/lib/engine/staff";

const schema = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "Bad PIN" }, { status: 400 });
  const staff = findStaffByPin(parsed.data.pin);
  if (!staff) return NextResponse.json({ ok: false, reason: "Wrong PIN" }, { status: 401 });
  return NextResponse.json({
    ok: true,
    staff: { id: staff.id, name: staff.name, role: staff.role },
  });
}
