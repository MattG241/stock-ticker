import "@/lib/engine/bootstrap";
import { NextResponse } from "next/server";
import { startCrash } from "@/lib/engine/crash";
import { store, recordAudit } from "@/lib/store";

export const dynamic = "force-dynamic";

const WEBHOOK_COOLDOWN_MS = 60_000;

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (token !== store.socialWebhookToken) {
    return NextResponse.json({ ok: false, reason: "bad token" }, { status: 401 });
  }
  const now = Date.now();
  if (now < store.socialWebhookCooldownAt) {
    return NextResponse.json(
      { ok: false, reason: "webhook rate limited" },
      { status: 429 },
    );
  }
  store.socialWebhookCooldownAt = now + WEBHOOK_COOLDOWN_MS;
  const result = startCrash({
    discountPercent: 0.25,
    durationSeconds: 120,
    triggeredBy: "social-webhook",
    triggeredVia: "social",
  });
  recordAudit("social-webhook", "crash.webhook.fire", {
    ok: result.ok,
    reason: result.ok ? undefined : result.reason,
  });
  if (!result.ok) return NextResponse.json(result, { status: 422 });
  return NextResponse.json({ ok: true, event: result.event });
}
