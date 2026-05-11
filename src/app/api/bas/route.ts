import "@/lib/engine/bootstrap";
import { basCsv } from "@/lib/engine/bas";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const csv = basCsv(from, to);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="drink-exchange-bas.csv"`,
    },
  });
}
