import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ entries: store.audit.slice(0, 200) });
}
