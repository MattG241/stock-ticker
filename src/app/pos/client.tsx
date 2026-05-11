"use client";
import { useMemo, useState } from "react";
import { useLiveState } from "@/lib/hooks/useLiveState";
import { formatAud } from "@/lib/money";
import { Logo } from "@/components/Logo";

interface CartLine {
  drinkId: string;
  name: string;
  emoji: string;
  unit: number;
  quantity: number;
}

const STAFF_PIN = "1234";

export function PosClient() {
  const { state, refresh } = useLiveState();
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [charging, setCharging] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">("card");

  const crashActive = state?.crash.active ?? false;
  const discount = state?.crash.event?.discountPercent ?? 0;
  const floor = state?.settings.minMarginMultiplier ?? 0.3;

  const cartView = useMemo(() => {
    if (!state) return { lines: [] as (CartLine & { liveUnit: number; lineTotal: number })[], subtotal: 0 };
    const lines = cart.map((l) => {
      const d = state.drinks.find((x) => x.id === l.drinkId);
      const live = d
        ? d.isDynamic && crashActive
          ? Math.max(d.currentPrice * (1 - discount), d.costPrice * (1 + floor))
          : d.currentPrice
        : l.unit;
      const liveUnit = Math.round(live * 100) / 100;
      return { ...l, liveUnit, lineTotal: Math.round(liveUnit * l.quantity * 100) / 100 };
    });
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    return { lines, subtotal: Math.round(subtotal * 100) / 100 };
  }, [cart, state, crashActive, discount, floor]);

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pin === STAFF_PIN) {
              setAuthed(true);
            } else {
              setToast({ kind: "err", msg: "Wrong PIN" });
            }
          }}
          className="card w-full max-w-sm"
        >
          <Logo size={28} />
          <h1 className="mt-6 text-lg font-semibold">Staff PIN</h1>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="mt-3 w-full rounded-lg border border-edge bg-bg-elev px-4 py-3 num text-2xl tracking-[0.5em]"
            placeholder="••••"
            autoFocus
          />
          <button className="btn-primary mt-3 w-full">Sign in</button>
          {toast && <p className="mt-3 text-sm text-bear">{toast.msg}</p>}
          <p className="mt-6 text-xs text-ink-dim">
            Dev PIN: <span className="num">1234</span>. Replace with Better Auth or Clerk before launch.
          </p>
        </form>
      </main>
    );
  }

  if (!state) return <div className="p-10 text-ink-dim">Connecting...</div>;

  const charge = async () => {
    if (!cartView.lines.length) return;
    setCharging(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: "staff-pos-1",
          paymentMethod,
          items: cartView.lines.map((l) => ({ drinkId: l.drinkId, quantity: l.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setToast({ kind: "err", msg: data.reason ?? "Order failed" });
      } else {
        setToast({ kind: "ok", msg: `Order #${data.order.orderNumber} - ${formatAud(data.order.total)}` });
        setCart([]);
        refresh();
      }
    } finally {
      setCharging(false);
    }
  };

  return (
    <main className="grid h-screen grid-cols-[1fr_22rem] bg-bg">
      <section className="overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <Logo size={22} />
          <div className="flex items-center gap-2">
            {state.connectionStatus !== "live" && (
              <span className="pill bg-amber/10 text-amber">{state.connectionStatus.toUpperCase()}</span>
            )}
            {crashActive && (
              <span className="pill bg-bear/15 text-bear">CRASH {Math.round(discount * 100)}% OFF</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
          {state.drinks.map((d) => {
            const unit = d.displayPrice;
            return (
              <button
                key={d.id}
                onClick={() =>
                  setCart((c) => {
                    const ex = c.find((l) => l.drinkId === d.id);
                    if (ex) return c.map((l) => (l.drinkId === d.id ? { ...l, quantity: l.quantity + 1 } : l));
                    return [
                      ...c,
                      { drinkId: d.id, name: d.name, emoji: d.emoji, unit, quantity: 1 },
                    ];
                  })
                }
                className="card text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{d.emoji}</span>
                  <span className="num text-xs text-ink-dim">{d.category}</span>
                </div>
                <div className="mt-2 text-sm font-semibold leading-tight">{d.name}</div>
                <div className={`mt-2 num text-xl font-bold ${crashActive && d.isDynamic ? "text-bear" : ""}`}>
                  {formatAud(unit)}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="border-l border-edge bg-bg-card p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Cart</h2>
          <button className="text-xs text-ink-dim hover:text-bear" onClick={() => setCart([])}>
            clear
          </button>
        </div>
        <div className="mt-3 flex-1 overflow-y-auto space-y-2">
          {cartView.lines.length === 0 && <p className="text-sm text-ink-dim">No items.</p>}
          {cartView.lines.map((l) => {
            const moved = Math.abs(l.liveUnit - l.unit) > 0.01;
            return (
              <div key={l.drinkId} className="rounded-lg border border-edge p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{l.emoji}</span>
                    <span className="text-sm">{l.name}</span>
                  </div>
                  <div className="num text-sm">{formatAud(l.lineTotal)}</div>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      className="btn px-2 py-0.5 text-xs"
                      onClick={() =>
                        setCart((c) =>
                          c
                            .map((x) =>
                              x.drinkId === l.drinkId ? { ...x, quantity: x.quantity - 1 } : x,
                            )
                            .filter((x) => x.quantity > 0),
                        )
                      }
                    >
                      -
                    </button>
                    <span className="num">{l.quantity}</span>
                    <button
                      className="btn px-2 py-0.5 text-xs"
                      onClick={() =>
                        setCart((c) =>
                          c.map((x) =>
                            x.drinkId === l.drinkId ? { ...x, quantity: x.quantity + 1 } : x,
                          ),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                  <div className={`num ${moved ? "text-amber" : "text-ink-dim"}`}>
                    {moved && "MOVED "} {formatAud(l.liveUnit)} / ea
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-sm text-ink-dim">
            <span>Subtotal (inc GST)</span>
            <span className="num">{formatAud(cartView.subtotal)}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPaymentMethod("card")}
              className={`btn flex-1 ${paymentMethod === "card" ? "border-bull text-bull" : ""}`}
            >
              Card
            </button>
            <button
              onClick={() => setPaymentMethod("cash")}
              className={`btn flex-1 ${paymentMethod === "cash" ? "border-bull text-bull" : ""}`}
            >
              Cash
            </button>
          </div>
          <button
            onClick={charge}
            disabled={charging || !cartView.lines.length}
            className="btn-primary w-full text-lg py-3"
          >
            {charging ? "Charging..." : `CHARGE ${formatAud(cartView.subtotal)}`}
          </button>
          {toast && (
            <p className={`text-sm ${toast.kind === "ok" ? "text-bull" : "text-bear"}`}>
              {toast.msg}
            </p>
          )}
          <p className="text-[10px] text-ink-dim">
            Stripe Terminal adapter pending. This button completes a paid order in the local store.
          </p>
        </div>
      </aside>
    </main>
  );
}
