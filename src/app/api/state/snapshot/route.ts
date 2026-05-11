import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(buildSnapshot());
}
