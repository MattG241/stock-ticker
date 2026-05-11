import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { listMarginAlerts } from "@/lib/engine/alerts";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ alerts: listMarginAlerts() });
}
