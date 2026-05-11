import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { revenuePerHour } from "@/lib/engine/summary";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ buckets: revenuePerHour(new Date()) });
}
