"use client";
import { useEffect, useMemo, useState } from "react";
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

interface QueuedOrder {
  id: string;
  body: {
    staffId: string;
    paymentMethod: "card" | "cash";
    items: { drinkId: string; quantity: number }[];
    tabId?: string;
    receipt?: { channel: "email" | "sms"; to: string };
  };
  attemptCount: number;
}

interface Tab {
  id: string;
  notes: string | null;
  orderNumber: number;
  lines: { drinkId: string; drinkNameSnapshot: string; quantity: number; lineTotal: number }[];
  total: number;
}

const QUEUE_KEY = "drink-exchange-pos-queue";

export function PosClient() {
  const { state, refresh } = useLiveState();
  const [pin, setPin] = useState("");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [charging, setCharging] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">("card");
  const [receiptTo, setReceiptTo] = useState("");
  const [queue, setQueue] = useState<QueuedOrder[]>([]);
  const [online, setOnline] = useState(true);
  const [voidPin, setVoidPin] = useState("");
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  // Hydrate offline queue from localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(QUEUE_KEY);
      if (raw) setQueue(JSON.parse(raw));
    } catch {}
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }, [queue]);

  // Drain the queue when we come back online.
  useEffect(() => {
    if (!online || queue.length === 0) return;
    const drain = async () => {
      for (const q of queue) {
        try {
          const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(q.body),
          });
          if (res.ok) {
            setQueue((cur) => cur.filter((x) => x.id !== q.id));
          } else {
            const data = await res.json().catch(() => ({}));
            if (res.status === 422) {
              setToast({ kind: "err", msg: `Queued order rejected: ${data.reason}. Removing.` });
              setQueue((cur) => cur.filter((x) => x.id !== q.id));
            } else {
              setQueue((cur) =>
                cur.map((x) => (x.id === q.id ? { ...x, attemptCount: x.attemptCount + 1 } : x)),
              );
            }
          }
        } catch {
          break;
        }
      }
    };
    drain();
  }, [online, queue]);

  // Refresh open tabs every few seconds while logged in.
  useEffect(() => {
    if (!staffId) return;
    const load = async () => {
      const res = await fetch("/api/tabs", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setOpenTabs(data.tabs ?? []);
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [staffId, online]);

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

  if (!staffId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-6">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch("/api/staff", { cache: "no-store" });
            if (!res.ok) {
              setPinError("Network error");
              return;
            }
            // We can't match the PIN client-side because they're masked;
            // instead, post a sentinel to /api/orders with a known PIN-only check.
            // Simpler: use a special probe via /api/staff/check.
            const r2 = await fetch("/api/auth/pin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pin }),
            });
            const data = await r2.json();
            if (!r2.ok || !data.ok) {
              setPinError(data.reason ?? "Wrong PIN");
              return;
            }
            setStaffId(data.staff.id);
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
          {pinError && <p className="mt-3 text-sm text-bear">{pinError}</p>}
          <p className="mt-6 text-xs text-ink-dim">
            Dev PINs: staff <span className="num">1234</span>, manager <span className="num">5678</span>, owner <span className="num">9999</span>.
            Replace with Better Auth or Clerk before launch.
          </p>
        </form>
      </main>
    );
  }

  if (!state) return <div className="p-10 text-ink-dim">Connecting...</div>;

  const addToCart = (drinkId: string, name: string, emoji: string, unit: number) => {
    setCart((c) => {
      const ex = c.find((l) => l.drinkId === drinkId);
      if (ex) return c.map((l) => (l.drinkId === drinkId ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { drinkId, name, emoji, unit, quantity: 1 }];
    });
  };

  const charge = async () => {
    if (!cartView.lines.length) return;
    setCharging(true);
    const body = {
      staffId,
      paymentMethod,
      items: cartView.lines.map((l) => ({ drinkId: l.drinkId, quantity: l.quantity })),
      tabId: activeTabId ?? undefined,
      receipt: receiptTo
        ? { channel: receiptTo.includes("@") ? ("email" as const) : ("sms" as const), to: receiptTo }
        : undefined,
    };
    try {
      if (!online) throw new Error("offline");
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setToast({ kind: "err", msg: data.reason ?? "Order failed" });
      } else {
        setToast({
          kind: "ok",
          msg: `Order #${data.order.orderNumber} - ${formatAud(data.order.total)} - receipt: /receipts/${data.order.id}`,
        });
        setCart([]);
        setActiveTabId(null);
        setReceiptTo("");
        refresh();
      }
    } catch {
      // Offline path: queue the order.
      const queued: QueuedOrder = {
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        body,
        attemptCount: 0,
      };
      setQueue((q) => [...q, queued]);
      setToast({ kind: "ok", msg: "Queued offline. Will send when connection returns." });
      setCart([]);
    } finally {
      setCharging(false);
    }
  };

  const saveAsTab = async () => {
    if (!cartView.lines.length) return;
    const tabName = prompt("Tab name (e.g. Sarah - bar 3)") || "Tab";
    const res = await fetch("/api/tabs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, tabName }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setToast({ kind: "err", msg: data.reason ?? "Could not open tab" });
      return;
    }
    const addRes = await fetch("/api/tabs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        tabId: data.order.id,
        staffId,
        items: cartView.lines.map((l) => ({ drinkId: l.drinkId, quantity: l.quantity })),
      }),
    });
    const addData = await addRes.json();
    if (!addRes.ok || !addData.ok) {
      setToast({ kind: "err", msg: addData.reason ?? "Could not add to tab" });
      return;
    }
    setToast({ kind: "ok", msg: `Tab "${tabName}" opened` });
    setCart([]);
  };

  const resumeTab = (tab: Tab) => {
    setActiveTabId(tab.id);
    setCart([]);
    setToast({ kind: "ok", msg: `Resumed tab #${tab.orderNumber}` });
  };

  const voidOrder = async () => {
    if (!voidTarget) return;
    const res = await fetch(`/api/orders/${voidTarget}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: voidPin, reason: voidReason || "manager void" }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setToast({ kind: "err", msg: data.reason ?? "Void failed" });
    } else {
      setToast({ kind: "ok", msg: "Order voided" });
    }
    setVoidTarget(null);
    setVoidPin("");
    setVoidReason("");
  };

  return (
    <main className="grid h-screen grid-cols-[1fr_24rem] bg-bg">
      <section className="overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <Logo size={22} />
          <div className="flex items-center gap-2">
            {!online && <span className="pill bg-amber/10 text-amber">OFFLINE - queued {queue.length}</span>}
            {state.connectionStatus !== "live" && online && (
              <span className="pill bg-amber/10 text-amber">{state.connectionStatus.toUpperCase()}</span>
            )}
            {crashActive && (
              <span className="pill bg-bear/15 text-bear">CRASH {Math.round(discount * 100)}% OFF</span>
            )}
            <button
              className="btn px-2 py-1 text-xs"
              onClick={() => setStaffId(null)}
            >
              Sign out
            </button>
          </div>
        </div>

        {openTabs.length > 0 && (
          <div className="mb-3">
            <div className="text-xs uppercase tracking-widest text-ink-dim mb-1">Open tabs</div>
            <div className="flex flex-wrap gap-2">
              {openTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => resumeTab(t)}
                  className={`btn text-xs ${activeTabId === t.id ? "border-bull text-bull" : ""}`}
                >
                  #{t.orderNumber} {t.notes ?? "tab"} - {formatAud(t.total)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
          {state.drinks.map((d) => {
            const unit = d.displayPrice;
            return (
              <button
                key={d.id}
                onClick={() => addToCart(d.id, d.name, d.emoji, unit)}
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
          <h2 className="font-semibold">
            Cart {activeTabId && <span className="text-xs text-bull ml-2">on tab</span>}
          </h2>
          <button className="text-xs text-ink-dim hover:text-bear" onClick={() => { setCart([]); setActiveTabId(null); }}>
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
                          c.map((x) =>
                            x.drinkId === l.drinkId ? { ...x, quantity: x.quantity - 1 } : x,
                          ).filter((x) => x.quantity > 0),
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
          <input
            type="text"
            value={receiptTo}
            onChange={(e) => setReceiptTo(e.target.value)}
            placeholder="Receipt to email or phone (optional)"
            className="w-full rounded-lg border border-edge bg-bg-elev px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button onClick={saveAsTab} disabled={!cartView.lines.length} className="btn flex-1">
              Save as tab
            </button>
            <button
              onClick={charge}
              disabled={charging || !cartView.lines.length}
              className="btn-primary flex-1 text-lg py-3"
            >
              {charging ? "Charging..." : `CHARGE ${formatAud(cartView.subtotal)}`}
            </button>
          </div>
          <button
            onClick={() => {
              const v = prompt("Order ID to void (post-charge)");
              if (v) setVoidTarget(v.trim());
            }}
            className="btn-danger w-full text-xs"
          >
            Manager void
          </button>
          {toast && (
            <p className={`text-sm ${toast.kind === "ok" ? "text-bull" : "text-bear"}`}>{toast.msg}</p>
          )}
          <p className="text-[10px] text-ink-dim">
            Payment provider: <code className="num">{process.env.NEXT_PUBLIC_PAYMENT_PROVIDER ?? "simulated"}</code>.
            Wire <code className="num">PAYMENT_PROVIDER=stripe</code> and Stripe creds before live trading.
          </p>
        </div>
      </aside>

      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80">
          <div className="card max-w-sm w-full">
            <h3 className="text-lg font-semibold">Manager void</h3>
            <p className="mt-1 text-xs text-ink-dim">Order id: {voidTarget}</p>
            <input
              type="password"
              value={voidPin}
              onChange={(e) => setVoidPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Manager PIN"
              className="mt-3 w-full rounded-lg border border-edge bg-bg-elev px-3 py-2 num"
            />
            <input
              type="text"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason"
              className="mt-2 w-full rounded-lg border border-edge bg-bg-elev px-3 py-2 text-sm"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setVoidTarget(null)} className="btn">Cancel</button>
              <button onClick={voidOrder} className="btn-danger">Void</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
