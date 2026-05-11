import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { shiftSummary } from "@/lib/engine/orders";
import { currentShift } from "@/lib/engine/shift";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ...shiftSummary(),
    current: currentShift(),
    history: store.shifts.slice(0, 30),
  });
}
