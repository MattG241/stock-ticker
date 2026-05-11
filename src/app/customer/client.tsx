"use client";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { QrImage } from "@/components/QrImage";
import { formatAud } from "@/lib/money";
import type { CustomerView } from "@/lib/types";

export function CustomerClient() {
  const [view, setView] = useState<CustomerView | null>(null);
  const [now, setNow] = useState(0);

  // Subscribe to SSE + initial GET.
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

    const tick = setInterval(() => setNow((x) => x + 1), 1000);

    return () => {
      stopped = true;
      es?.close();
      clearInterval(tick);
    };
  }, []);

  const status = view?.status ?? "idle";
  const hasLines = (view?.lines?.length ?? 0) > 0;

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
              {/* `now` used so React recomputes time */}
              <span className="hidden">{now}</span>
            </div>
          </div>
        </div>
        <div className="brand-divider mt-3" />
      </header>

      <section className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-3xl">
          {status === "idle" && !hasLines && <IdleState />}

          {status === "paid" && <PaidState view={view!} />}

          {status === "failed" && <FailedState />}

          {(status === "building" ||
            status === "awaiting-tip" ||
            status === "awaiting-cash" ||
            status === "processing") &&
            hasLines && <OrderState view={view!} />}
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
        Live drink prices float with demand. When you buy, that ticker moves. Crashes trigger market-wide
        discounts on every dynamic drink.
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
            <div className="flex items-center gap-3">
              <span className="ticker-symbol">{l.ticker}</span>
              <span className="serif text-lg font-semibold">{l.name}</span>
              <span className="num text-[10px] uppercase tracking-[0.18em] text-ink-dim">
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
            <span className="num">{view.cashAdjustment >= 0 ? "+" : ""}{formatAud(view.cashAdjustment)}</span>
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

function PaidState({ view }: { view: CustomerView }) {
  return (
    <div className="panel-brass frame-deco flex flex-col items-center gap-5 py-10 text-center">
      <div className="num rounded-sm border border-bull/60 bg-bull/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-bull">
        Trade settled
      </div>
      <h1 className="serif text-5xl font-semibold">Thank you.</h1>
      <div className="num text-base text-ink-dim">
        Order #{(view.lastOrderNumber ?? 0).toString().padStart(4, "0")} · {formatAud(view.total + view.tipAmount)}
      </div>
      {view.changeDue !== null && view.changeDue > 0 && (
        <div className="mt-2 flex flex-col items-center">
          <span className="label">Change due</span>
          <span className="num text-3xl font-semibold text-bull">{formatAud(view.changeDue)}</span>
        </div>
      )}
      {view.lastReceiptUrl && (
        <div className="mt-2 flex flex-col items-center gap-2">
          <QrImage value={view.lastReceiptUrl} size={160} />
          <span className="text-[10px] uppercase tracking-[0.22em] text-ink-dim">
            Scan for your receipt
          </span>
        </div>
      )}
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
    "awaiting-tip": { label: "Tip selection", cls: "border-brass/40 text-brass" },
    "awaiting-cash": { label: "Cash · awaiting tender", cls: "border-amber/40 text-amber" },
    processing: { label: "Processing…", cls: "border-amber/40 text-amber" },
    paid: { label: "Paid · Thank you", cls: "border-bull/60 text-bull" },
    failed: { label: "Failed", cls: "border-bear/60 text-bear" },
  };
  const v = map[status];
  return (
    <span className={`pill ${v.cls}`}>{v.label}</span>
  );
}
