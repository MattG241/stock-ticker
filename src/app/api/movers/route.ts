import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { biggestMover, recentSales } from "@/lib/engine/movers";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    biggestMover: biggestMover(),
    recentSales: recentSales(),
  });
}
