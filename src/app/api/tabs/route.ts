import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addToTab, listOpenTabs, openTab } from "@/lib/engine/orders";

const openSchema = z.object({
  staffId: z.string().min(1),
  tabName: z.string().min(1).max(80),
});

const addSchema = z.object({
  tabId: z.string().min(1),
  staffId: z.string().min(1),
  items: z
    .array(z.object({ drinkId: z.string(), quantity: z.number().int().positive().max(99) }))
    .min(1),
});

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ tabs: listOpenTabs() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (body?.action === "add") {
    const parsed = addSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
    const result = addToTab(parsed.data.tabId, parsed.data.staffId, parsed.data.items);
    if (!result.ok) return NextResponse.json(result, { status: 422 });
    return NextResponse.json({ ok: true, order: result.order });
  }
  const parsed = openSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
  const order = openTab(parsed.data.staffId, parsed.data.tabName);
  return NextResponse.json({ ok: true, order });
}
