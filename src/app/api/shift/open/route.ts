import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { openShift } from "@/lib/engine/shift";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const opener = typeof body?.openedBy === "string" ? body.openedBy : "admin";
  const shift = openShift(opener);
  return NextResponse.json({ ok: true, shift });
}
