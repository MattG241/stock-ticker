import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { dailySummary, dailySummaryHtml } from "@/lib/engine/summary";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("format") === "html") {
    return new Response(dailySummaryHtml(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return NextResponse.json({ summary: dailySummary() });
}
