import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { z } from "zod";
import { deactivateStaff, listStaff, upsertStaff } from "@/lib/engine/staff";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
  role: z.enum(["staff", "manager", "admin", "owner"]),
  isActive: z.boolean().default(true),
});

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ staff: listStaff().map((s) => ({ ...s, pin: "••••" })) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ ok: false, reason: parsed.error.issues[0]?.message ?? "bad payload" }, { status: 400 });
  const s = upsertStaff(parsed.data);
  return NextResponse.json({ ok: true, staff: { ...s, pin: "••••" } });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, reason: "id required" }, { status: 400 });
  const ok = deactivateStaff(id);
  return NextResponse.json({ ok });
}
