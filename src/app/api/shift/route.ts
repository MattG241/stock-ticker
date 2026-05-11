import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { shiftSummary } from "@/lib/engine/orders";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(shiftSummary());
}
