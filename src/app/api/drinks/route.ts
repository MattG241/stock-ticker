import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { z } from "zod";
import { broadcast, pushHistory, recordAudit, store } from "@/lib/store";
import { nowIso } from "@/lib/time";
import type { Drink, DrinkCategory } from "@/lib/types";

const categoryEnum = z.enum(["Cocktails", "Beer", "Wine", "Spirits", "Shots", "Non-Alc"]);

const createSchema = z
  .object({
    id: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/).optional(),
    ticker: z.string().min(1).max(8),
    name: z.string().min(1).max(80),
    category: categoryEnum,
    emoji: z.string().min(1).max(4).default("🍸"),
    basePrice: z.number().positive().max(10_000),
    costPrice: z.number().positive().max(10_000),
    minPriceMultiplier: z.number().positive().max(10).default(0.5),
    maxPriceMultiplier: z.number().positive().max(10).default(2.5),
    isDynamic: z.boolean().default(true),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  })
  .refine((v) => v.maxPriceMultiplier >= v.minPriceMultiplier, {
    message: "maxPriceMultiplier must be >= minPriceMultiplier",
    path: ["maxPriceMultiplier"],
  });

const patchSchema = z.object({
  id: z.string().min(1),
  ticker: z.string().min(1).max(8).optional(),
  name: z.string().min(1).max(80).optional(),
  category: categoryEnum.optional(),
  emoji: z.string().min(1).max(4).optional(),
  basePrice: z.number().positive().max(10_000).optional(),
  currentPrice: z.number().positive().max(10_000).optional(),
  costPrice: z.number().positive().max(10_000).optional(),
  minPriceMultiplier: z.number().positive().max(10).optional(),
  maxPriceMultiplier: z.number().positive().max(10).optional(),
  isDynamic: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const deleteSchema = z.object({ id: z.string().min(1) });

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ drinks: [...store.drinks.values()] });
}

function slugFromTicker(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function tickerExists(ticker: string, excludeId?: string): boolean {
  const norm = ticker.trim().toUpperCase();
  for (const d of store.drinks.values()) {
    if (d.id === excludeId) continue;
    if (d.ticker.toUpperCase() === norm) return true;
  }
  return false;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: parsed.error.issues[0]?.message ?? "Bad payload" },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const ticker = input.ticker.trim().toUpperCase();
  if (tickerExists(ticker)) {
    return NextResponse.json(
      { ok: false, reason: `Ticker ${ticker} already in use` },
      { status: 409 },
    );
  }
  const id = input.id ?? slugFromTicker(ticker);
  if (!id) {
    return NextResponse.json({ ok: false, reason: "Could not derive id" }, { status: 400 });
  }
  if (store.drinks.has(id)) {
    return NextResponse.json(
      { ok: false, reason: `Drink id ${id} already exists` },
      { status: 409 },
    );
  }
  const ts = nowIso();
  const drink: Drink = {
    id,
    ticker,
    name: input.name.trim(),
    category: input.category as DrinkCategory,
    emoji: input.emoji,
    basePrice: input.basePrice,
    currentPrice: input.basePrice,
    costPrice: input.costPrice,
    minPriceMultiplier: input.minPriceMultiplier,
    maxPriceMultiplier: input.maxPriceMultiplier,
    isDynamic: input.isDynamic,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
    createdAt: ts,
    updatedAt: ts,
  };
  store.drinks.set(id, drink);
  pushHistory(id, Date.now(), drink.currentPrice);
  recordAudit("admin", "drink.create", { id, ticker, name: drink.name });
  broadcast({ type: "drink.updated", payload: drink });
  return NextResponse.json({ ok: true, drink });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
  }
  const d = store.drinks.get(parsed.data.id);
  if (!d) return NextResponse.json({ ok: false, reason: "Unknown drink" }, { status: 404 });

  const next = { ...parsed.data };
  if (next.ticker) {
    next.ticker = next.ticker.trim().toUpperCase();
    if (tickerExists(next.ticker, d.id)) {
      return NextResponse.json(
        { ok: false, reason: `Ticker ${next.ticker} already in use` },
        { status: 409 },
      );
    }
  }
  if (next.name) next.name = next.name.trim();
  if (
    next.minPriceMultiplier !== undefined &&
    next.maxPriceMultiplier !== undefined &&
    next.maxPriceMultiplier < next.minPriceMultiplier
  ) {
    return NextResponse.json(
      { ok: false, reason: "maxPriceMultiplier must be >= minPriceMultiplier" },
      { status: 400 },
    );
  }

  const before = { ...d };
  Object.assign(d, next, { updatedAt: nowIso() });
  recordAudit("admin", "drink.update", { id: d.id, before, after: { ...d } });
  broadcast({ type: "drink.updated", payload: d });
  return NextResponse.json({ ok: true, drink: d });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "Bad payload" }, { status: 400 });
  }
  const d = store.drinks.get(parsed.data.id);
  if (!d) return NextResponse.json({ ok: false, reason: "Unknown drink" }, { status: 404 });

  // Refuse to delete if this drink is on any open tab (would leave the tab
  // pointing at a missing drink).
  const onOpenTab = store.orders.some(
    (o) => o.status === "open" && o.lines.some((l) => l.drinkId === d.id),
  );
  if (onOpenTab) {
    return NextResponse.json(
      { ok: false, reason: "Drink is on an open tab. Close the tab first." },
      { status: 409 },
    );
  }

  // Historical paid/voided/refunded orders carry a name snapshot, so they're
  // safe even after delete - the drinkId remains a dangling reference.
  store.drinks.delete(d.id);
  store.history.delete(d.id);
  store.marginAlerts.delete(d.id);
  recordAudit("admin", "drink.delete", { id: d.id, ticker: d.ticker, name: d.name });
  broadcast({ type: "drink.deleted", payload: { drinkId: d.id } });
  return NextResponse.json({ ok: true });
}
