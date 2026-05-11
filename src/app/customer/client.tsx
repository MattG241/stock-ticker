"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { QrImage } from "@/components/QrImage";
import { formatAud } from "@/lib/money";
import type { CustomerView } from "@/lib/types";

const TIP_PRESETS = [0.1, 0.15, 0.2];

export function CustomerClient() {
  const [view, setView] = useState<CustomerView | null>(null);
  const [, setNowTick] = useState(0);

  useEffect(() => {
    let stopped = false;
    fetch("/api/pos/customer-view", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!stopped) setView(d.view);
      })
      .catch(() => {});

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/events");
      es.addEventListener("customer.view.updated", (e) => {
        try {
          const payload = JSON.parse((e as MessageEvent).data) as CustomerView;
          if (!stopped) setView(payload);
        } catch {
          // ignore
        }
      });
    } catch {
      // SSE not available
    }

    const tick = setInterval(() => setNowTick((x) => x + 1), 1000);

    return () => {
      stopped = true;
      es?.close();
      clearInterval(tick);
    };
  }, []);

  const patchView = useCallback(async (patch: Partial<CustomerView>) => {
    try {
      const res = await fetch("/api/pos/customer-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data?.view) setView(data.view);
    } catch {
      // ignore
    }
  }, []);

  const status = view?.status ?? "idle";
  const hasLines = (view?.lines?.length ?? 0) > 0;

  // The base used for tip percentages (post-discount, pre-cash-rounding for card;
  // cash uses the rounded total so the tip is on top of what's actually paid).
  const tipBase = useMemo(() => {
    if (!view) return 0;
    if (view.paymentMethod === "cash") {
      return view.subtotal - view.discountAmount + view.cashAdjustment;
    }
    return view.subtotal - view.discountAmount;
  }, [view]);

  return (
    <main className="display-scanlines flex min-h-screen flex-col bg-bg text-ink">
      <header className="border-b border-edge bg-black/40 px-8 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Logo size={26} variant="stacked" />
          <div className="text-right">
            <div className="label">Live order</div>
            <div className="num text-[10px] tracking-[0.18em] text-ink-ghost">
              {new Date().toLocaleTimeString("en-AU", {
                timeZone: "Australia/Adelaide",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </div>
          </div>
        </div>
        <div className="brand-divider mt-3" />
      </header>

      <section className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {status === "idle" && !hasLines && <IdleState />}

          {(status === "building" ||
            status === "awaiting-customer-tip" ||
            status === "customer-tip-confirmed" ||
            status === "awaiting-card-tap" ||
            status === "customer-card-tapped" ||
            status === "awaiting-cash-tender" ||
            status === "processing") &&
            hasLines && (
              <>
                <OrderState view={view!} />
                {status === "awaiting-customer-tip" && (
                  <TipChooser
                    base={tipBase}
                    paymentMethod={view!.paymentMethod}
                    onPick={(tipAmount) =>
                      patchView({ status: "customer-tip-confirmed", tipAmount })
                    }
                  />
                )}
                {status === "customer-tip-confirmed" && (
                  <SimpleNotice title="Tip locked in." body="One moment…" />
                )}
                {status === "awaiting-card-tap" && (
                  <TapToPay onTap={() => patchView({ status: "customer-card-tapped" })} />
                )}
                {status === "customer-card-tapped" && (
                  <SimpleNotice title="Reading card…" body="Hold still." />
                )}
                {status === "awaiting-cash-tender" && view!.paymentMethod === "cash" && (
                  <CashHandoff total={view!.total + view!.tipAmount} />
                )}
                {status === "processing" && (
                  <SimpleNotice title="Settling trade…" body="Almost there." />
                )}
              </>
            )}

          {status === "paid" && view && (
            <PaidState view={view} onEmail={patchView} />
          )}

          {status === "failed" && <FailedState />}
        </div>
      </section>

      <footer className="border-t border-edge bg-black/40 px-8 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="label">The Drink Exchange</span>
          <StatusBadge status={status} />
        </div>
      </footer>
    </main>
  );
}

function IdleState() {
  return (
    <div className="panel-brass frame-deco flex flex-col items-center gap-4 py-16 text-center">
      <div className="label">Welcome</div>
      <h1 className="serif text-5xl font-semibold tracking-tight">Trade your first round.</h1>
      <p className="mt-2 max-w-md text-sm text-ink-dim">
        Live drink prices float with demand. When you buy, that ticker moves. Crashes trigger
        market-wide discounts on every dynamic drink.
      </p>
      <div className="num text-[11px] uppercase tracking-[0.32em] text-brass-dim">
        Your order will appear here
      </div>
    </div>
  );
}

function OrderState({ view }: { view: CustomerView }) {
  const showCashLine = view.paymentMethod === "cash" && Math.abs(view.cashAdjustment) > 0.001;
  const showTipLine = view.tipAmount > 0;
  const showDiscountLine = view.discountAmount > 0;

  return (
    <div className="panel-brass frame-deco">
      <div className="flex items-center justify-between">
        <div className="label">Your order</div>
        <div className="num text-[10px] tracking-[0.18em] text-brass-dim">
          {view.paymentMethod === "card"
            ? "PAYMENT · CARD"
            : view.paymentMethod === "cash"
              ? "PAYMENT · CASH"
              : "PAYMENT · TBD"}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {view.lines.map((l) => (
          <div
            key={l.drinkId}
            className="flex items-baseline justify-between border-b border-edge/40 py-2"
          >
            <div className="flex flex-1 items-center gap-3 min-w-0">
              <span className="ticker-symbol shrink-0">{l.ticker}</span>
              <span className="serif text-lg font-semibold truncate">{l.name}</span>
              <span className="num shrink-0 text-[10px] uppercase tracking-[0.18em] text-ink-dim">
                {l.quantity} × {formatAud(l.unitPrice)}
              </span>
            </div>
            <span className="num text-xl font-semibold">{formatAud(l.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-1 text-sm">
        <div className="flex items-center justify-between text-ink-dim">
          <span>Subtotal (inc GST)</span>
          <span className="num">{formatAud(view.subtotal)}</span>
        </div>
        {showDiscountLine && (
          <div className="flex items-center justify-between text-bull">
            <span>Comp {view.discountReason ? `· ${view.discountReason}` : ""}</span>
            <span className="num">−{formatAud(view.discountAmount)}</span>
          </div>
        )}
        {showCashLine && (
          <div className="flex items-center justify-between text-amber">
            <span>Cash rounding</span>
            <span className="num">
              {view.cashAdjustment >= 0 ? "+" : ""}
              {formatAud(view.cashAdjustment)}
            </span>
          </div>
        )}
        {showTipLine && (
          <div className="flex items-center justify-between text-bull">
            <span>Tip</span>
            <span className="num">+{formatAud(view.tipAmount)}</span>
          </div>
        )}
      </div>

      <div className="brand-divider my-4" />

      <div className="flex items-baseline justify-between">
        <span className="label text-brass">Total due</span>
        <span className="num text-5xl font-semibold text-ink">
          {formatAud(view.total + view.tipAmount)}
        </span>
      </div>
    </div>
  );
}

function TipChooser({
  base,
  paymentMethod,
  onPick,
}: {
  base: number;
  paymentMethod: CustomerView["paymentMethod"];
  onPick: (tip: number) => void;
}) {
  const [custom, setCustom] = useState("");
  return (
    <div className="panel-brass">
      <h2 className="serif text-2xl font-semibold text-brass">Add a tip?</h2>
      <p className="mt-1 text-xs text-ink-dim">
        100% of tips go to your bartender. {paymentMethod === "cash" ? "Cash tip added on top." : ""}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {TIP_PRESETS.map((p) => {
          const tip = Math.round(base * p * 100) / 100;
          return (
            <button
              key={p}
              onClick={() => onPick(tip)}
              className="btn-brass flex flex-col items-center gap-1 py-5 text-base"
            >
              <span className="text-3xl font-semibold">{Math.round(p * 100)}%</span>
              <span className="num text-xs text-ink-dim">{formatAud(tip)}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Custom $"
          className="flex-1 rounded-sm px-3 py-3 num text-lg"
        />
        <button
          onClick={() => {
            const t = parseFloat(custom);
            onPick(Number.isFinite(t) && t > 0 ? Math.round(t * 100) / 100 : 0);
          }}
          className="btn-primary px-6 py-3 text-sm"
        >
          Apply
        </button>
      </div>
      <button
        onClick={() => onPick(0)}
        className="btn mt-3 w-full py-3 text-sm uppercase tracking-[0.18em]"
      >
        No tip
      </button>
    </div>
  );
}

function TapToPay({ onTap }: { onTap: () => void }) {
  return (
    <div className="panel-brass frame-deco flex flex-col items-center gap-5 py-12 text-center">
      <div className="label text-brass">Card payment</div>
      <div className="serif text-3xl font-semibold">Tap your card to pay.</div>
      <button
        onClick={onTap}
        className="btn-primary group flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-full text-base"
      >
        <span className="text-4xl">⟟</span>
        <span className="text-[11px] uppercase tracking-[0.22em]">Tap to pay</span>
      </button>
      <div className="num text-[10px] uppercase tracking-[0.32em] text-brass-dim">
        Hold your card or device against the reader
      </div>
    </div>
  );
}

function CashHandoff({ total }: { total: number }) {
  return (
    <div className="panel-brass frame-deco flex flex-col items-center gap-3 py-10 text-center">
      <div className="label text-brass">Cash payment</div>
      <div className="serif text-3xl font-semibold">Hand your cash to the bartender.</div>
      <div className="mt-2">
        <span className="label">Total due</span>
        <div className="num text-5xl font-semibold text-ink">{formatAud(total)}</div>
      </div>
    </div>
  );
}

function SimpleNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel-brass flex flex-col items-center gap-2 py-10 text-center">
      <div className="serif text-2xl font-semibold text-brass">{title}</div>
      <div className="text-sm text-ink-dim">{body}</div>
    </div>
  );
}

function PaidState({
  view,
  onEmail,
}: {
  view: CustomerView;
  onEmail: (patch: Partial<CustomerView>) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sent = view.receiptSent;

  const submitEmail = async () => {
    if (!view.lastOrderId) return;
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("Enter a valid email");
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/orders/${view.lastOrderId}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "email", to: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.reason ?? "Send failed");
      } else {
        await onEmail({ customerEmail: trimmed, receiptSent: true });
      }
    } catch {
      setError("Network error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="panel-brass frame-deco flex flex-col items-center gap-5 py-10 text-center">
      <div className="num rounded-sm border border-bull/60 bg-bull/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-bull">
        Trade settled
      </div>
      <h1 className="serif text-5xl font-semibold">Thank you.</h1>
      <div className="num text-base text-ink-dim">
        Order #{(view.lastOrderNumber ?? 0).toString().padStart(4, "0")} ·{" "}
        {formatAud(view.total + view.tipAmount)}
      </div>
      {view.changeDue !== null && view.changeDue > 0 && (
        <div className="mt-2 flex flex-col items-center">
          <span className="label">Change due</span>
          <span className="num text-3xl font-semibold text-bull">{formatAud(view.changeDue)}</span>
        </div>
      )}

      <div className="brand-divider w-full" />

      <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex flex-col items-center gap-2">
          <span className="label">Scan</span>
          {view.lastReceiptUrl && <QrImage value={view.lastReceiptUrl} size={160} />}
          <span className="text-[10px] uppercase tracking-[0.22em] text-ink-dim">
            Scan for your receipt
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="label">Or email</span>
          {sent ? (
            <div className="flex flex-col items-center gap-1 py-4 text-bull">
              <span className="text-3xl">✓</span>
              <span className="text-xs uppercase tracking-[0.18em]">
                Sent to {view.customerEmail}
              </span>
            </div>
          ) : (
            <>
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full max-w-xs rounded-sm px-3 py-3 text-sm"
              />
              <button
                onClick={submitEmail}
                disabled={sending}
                className="btn-primary mt-1 w-full max-w-xs py-2 text-sm disabled:opacity-50"
              >
                {sending ? "Sending..." : "Email receipt"}
              </button>
              {error && (
                <div className="text-[10px] uppercase tracking-[0.18em] text-bear">{error}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FailedState() {
  return (
    <div className="panel border-bear/40 bg-bear/5 py-10 text-center">
      <div className="label text-bear">Trade rejected</div>
      <h1 className="mt-3 serif text-3xl font-semibold text-bear">Order didn't go through.</h1>
      <p className="mt-2 text-sm text-ink-dim">
        Your bartender will sort it out — no charge has been made.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: CustomerView["status"] }) {
  const map: Record<CustomerView["status"], { label: string; cls: string }> = {
    idle: { label: "Awaiting order", cls: "border-brass/40 text-brass" },
    building: { label: "Building order", cls: "border-brass/40 text-brass" },
    "awaiting-customer-tip": { label: "Choose tip", cls: "border-bull/60 text-bull" },
    "customer-tip-confirmed": { label: "Tip locked", cls: "border-brass/40 text-brass" },
    "awaiting-card-tap": { label: "Tap card to pay", cls: "border-bull/60 text-bull" },
    "customer-card-tapped": { label: "Reading card", cls: "border-amber/40 text-amber" },
    "awaiting-cash-tender": { label: "Cash · with bartender", cls: "border-amber/40 text-amber" },
    processing: { label: "Processing…", cls: "border-amber/40 text-amber" },
    paid: { label: "Paid · Thank you", cls: "border-bull/60 text-bull" },
    failed: { label: "Failed", cls: "border-bear/60 text-bear" },
  };
  const v = map[status];
  return <span className={`pill ${v.cls}`}>{v.label}</span>;
}
