"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveState } from "@/lib/hooks/useLiveState";
import { formatAud, roundCashAud } from "@/lib/money";
import { Logo } from "@/components/Logo";

interface CartLine {
  drinkId: string;
  ticker: string;
  name: string;
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
    idempotencyKey: string;
    idCheck?: boolean;
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
const QTY_PRESETS = [4, 6, 8];

function newIdempotencyKey() {
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  const [search, setSearch] = useState("");
  const [tabModal, setTabModal] = useState(false);
  const [tabName, setTabName] = useState("");
  const [tabIdCheck, setTabIdCheck] = useState(false);
  const [refusalOpen, setRefusalOpen] = useState(false);
  const [refusalReason, setRefusalReason] = useState<"intoxication" | "id" | "behaviour" | "other">("intoxication");
  const [refusalNotes, setRefusalNotes] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

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
              setToast({ kind: "err", msg: `Queued order rejected: ${data.reason}` });
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
    if (!state) return { lines: [] as (CartLine & { liveUnit: number; lineTotal: number })[], subtotal: 0, cashTotal: 0 };
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
    const rounded = Math.round(subtotal * 100) / 100;
    return { lines, subtotal: rounded, cashTotal: roundCashAud(rounded) };
  }, [cart, state, crashActive, discount, floor]);

  const filteredDrinks = useMemo(() => {
    if (!state) return [];
    const q = search.trim().toLowerCase();
    if (!q) return state.drinks;
    return state.drinks.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.ticker.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q),
    );
  }, [state, search]);

  if (!staffId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-6">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch("/api/auth/pin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pin }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
              setPinError(data.reason ?? "Wrong PIN");
              return;
            }
            setStaffId(data.staff.id);
          }}
          className="panel w-full max-w-sm"
        >
          <Logo size={22} />
          <h1 className="mt-6 text-xs uppercase tracking-[0.32em] text-ink-dim">Staff terminal</h1>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="mt-3 w-full rounded-sm px-4 py-3 num text-2xl tracking-[0.5em]"
            placeholder="••••"
            autoFocus
          />
          <button className="btn-primary mt-3 w-full">Sign in</button>
          {pinError && <p className="mt-3 text-xs uppercase tracking-[0.18em] text-bear">{pinError}</p>}
        </form>
      </main>
    );
  }

  if (!state) return <div className="p-10 text-ink-dim">Connecting...</div>;

  const addToCart = (drinkId: string, ticker: string, name: string, unit: number, qty = 1) => {
    setCart((c) => {
      const ex = c.find((l) => l.drinkId === drinkId);
      if (ex) return c.map((l) => (l.drinkId === drinkId ? { ...l, quantity: l.quantity + qty } : l));
      return [...c, { drinkId, ticker, name, unit, quantity: qty }];
    });
  };

  const setQuantity = (drinkId: string, qty: number) => {
    if (qty <= 0) {
      setCart((c) => c.filter((l) => l.drinkId !== drinkId));
    } else {
      setCart((c) => c.map((l) => (l.drinkId === drinkId ? { ...l, quantity: qty } : l)));
    }
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
      idempotencyKey: newIdempotencyKey(),
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
          msg: `Order #${data.order.orderNumber} · ${formatAud(data.order.total)} · /receipts/${data.order.id}`,
        });
        setCart([]);
        setActiveTabId(null);
        setReceiptTo("");
        refresh();
      }
    } catch {
      const queued: QueuedOrder = {
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        body,
        attemptCount: 0,
      };
      setQueue((q) => [...q, queued]);
      setToast({ kind: "ok", msg: "Queued offline · will send on reconnect" });
      setCart([]);
    } finally {
      setCharging(false);
    }
  };

  const saveAsTab = async () => {
    if (!cartView.lines.length) return;
    setTabModal(true);
  };

  const submitTab = async () => {
    const name = tabName.trim() || "Tab";
    const res = await fetch("/api/tabs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, tabName: name }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setToast({ kind: "err", msg: data.reason ?? "Could not open tab" });
      setTabModal(false);
      return;
    }
    if (cartView.lines.length) {
      await fetch("/api/tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          tabId: data.order.id,
          staffId,
          items: cartView.lines.map((l) => ({ drinkId: l.drinkId, quantity: l.quantity })),
        }),
      });
    }
    setToast({ kind: "ok", msg: `Tab "${name}" opened · ID ${tabIdCheck ? "checked" : "NOT checked"}` });
    setCart([]);
    setTabName("");
    setTabIdCheck(false);
    setTabModal(false);
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

  const submitRefusal = async () => {
    const refusalPin = prompt("Your PIN to log refusal");
    if (!refusalPin) return;
    const res = await fetch("/api/refusal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: refusalPin, reason: refusalReason, notes: refusalNotes || "—" }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setToast({ kind: "err", msg: data.reason ?? "Refusal logging failed" });
    } else {
      setToast({ kind: "ok", msg: "Refusal logged" });
      setRefusalNotes("");
    }
    setRefusalOpen(false);
  };

  return (
    <main className="grid h-screen grid-cols-[1fr_22rem] bg-bg">
      <section className="overflow-y-auto p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Logo size={18} />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drinks..."
            className="flex-1 max-w-xs rounded-sm px-3 py-1.5 text-xs"
          />
          <div className="flex items-center gap-2">
            {!online && (
              <span className="pill border-amber/40 text-amber">Offline · queued {queue.length}</span>
            )}
            {state.connectionStatus !== "live" && online && (
              <span className="pill border-amber/40 text-amber">
                {state.connectionStatus.toUpperCase()}
              </span>
            )}
            {crashActive && (
              <span className="pill border-bear/40 text-bear">
                Crash {Math.round(discount * 100)}%
              </span>
            )}
            <button className="btn" onClick={() => setRefusalOpen(true)}>RSA refuse</button>
            <button className="btn" onClick={() => setStaffId(null)}>Sign out</button>
          </div>
        </div>

        {openTabs.length > 0 && (
          <div className="mb-3">
            <div className="label mb-1">Open tabs</div>
            <div className="flex flex-wrap gap-2">
              {openTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => resumeTab(t)}
                  className={`btn ${activeTabId === t.id ? "border-bull text-bull" : ""}`}
                >
                  #{t.orderNumber} · {t.notes ?? "tab"} · {formatAud(t.total)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-5">
          {filteredDrinks.map((d) => {
            const unit = d.displayPrice;
            return (
              <button
                key={d.id}
                onClick={() => addToCart(d.id, d.ticker, d.name, unit)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const q = prompt(`Add how many ${d.name}?`, "4");
                  if (q) {
                    const n = parseInt(q, 10);
                    if (n > 0) addToCart(d.id, d.ticker, d.name, unit, n);
                  }
                }}
                className="panel-tight text-left transition active:scale-[0.98] hover:border-edge-bright"
              >
                <div className="text-sm font-semibold leading-tight">{d.name}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="ticker-symbol">{d.ticker}</span>
                  <span className="label">{d.category}</span>
                </div>
                <div className={`mt-2 num text-xl font-semibold ${crashActive && d.isDynamic ? "text-bear" : ""}`}>
                  {formatAud(unit)}
                </div>
              </button>
            );
          })}
          {filteredDrinks.length === 0 && (
            <div className="col-span-full num text-[11px] uppercase tracking-[0.18em] text-ink-dim">
              [ no drinks match &ldquo;{search}&rdquo; ]
            </div>
          )}
        </div>
      </section>

      <aside className="flex flex-col border-l border-edge bg-bg-card p-3">
        <div className="flex items-center justify-between">
          <h2 className="label text-ink">
            Cart {activeTabId && <span className="ml-2 text-bull">· on tab</span>}
          </h2>
          <button
            className="text-[10px] uppercase tracking-[0.18em] text-ink-dim hover:text-bear"
            onClick={() => { setCart([]); setActiveTabId(null); }}
          >
            clear
          </button>
        </div>
        <div className="mt-3 flex-1 overflow-y-auto space-y-2">
          {cartView.lines.length === 0 && (
            <p className="num text-[11px] uppercase tracking-[0.18em] text-ink-dim">[ empty ]</p>
          )}
          {cartView.lines.map((l) => {
            const moved = Math.abs(l.liveUnit - l.unit) > 0.01;
            return (
              <div key={l.drinkId} className="rounded-sm border border-edge p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="ticker-symbol">{l.ticker}</span>
                    <span className="text-xs">{l.name}</span>
                  </div>
                  <div className="num text-sm font-semibold">{formatAud(l.lineTotal)}</div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1">
                    <button
                      className="btn px-2 py-0.5"
                      onClick={() => setQuantity(l.drinkId, l.quantity - 1)}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={l.quantity}
                      onChange={(e) => setQuantity(l.drinkId, parseInt(e.target.value, 10) || 0)}
                      className="w-10 rounded-sm px-1 py-0.5 num text-center"
                    />
                    <button
                      className="btn px-2 py-0.5"
                      onClick={() => setQuantity(l.drinkId, l.quantity + 1)}
                    >
                      +
                    </button>
                    {QTY_PRESETS.map((n) => (
                      <button
                        key={n}
                        className="btn px-1.5 py-0.5"
                        onClick={() => setQuantity(l.drinkId, l.quantity + n)}
                      >
                        +{n}
                      </button>
                    ))}
                  </div>
                  <div className={`num ${moved ? "text-amber" : "text-ink-dim"}`}>
                    {moved && "MOVED · "}{formatAud(l.liveUnit)}/u
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 space-y-2 border-t border-edge pt-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-ink-dim">
            <span>Subtotal · inc GST</span>
            <span className="num text-base font-semibold text-ink">{formatAud(cartView.subtotal)}</span>
          </div>
          {paymentMethod === "cash" && cartView.cashTotal !== cartView.subtotal && (
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-amber">
              <span>Cash · 5c round</span>
              <span className="num">{formatAud(cartView.cashTotal)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPaymentMethod("card")}
              className={`btn ${paymentMethod === "card" ? "border-bull text-bull" : ""}`}
            >
              Card
            </button>
            <button
              onClick={() => setPaymentMethod("cash")}
              className={`btn ${paymentMethod === "cash" ? "border-bull text-bull" : ""}`}
            >
              Cash
            </button>
          </div>
          <input
            type="text"
            value={receiptTo}
            onChange={(e) => setReceiptTo(e.target.value)}
            placeholder="Receipt · email or mobile (optional)"
            className="w-full rounded-sm px-3 py-2 text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={saveAsTab} className="btn">
              Save as tab
            </button>
            <button
              onClick={charge}
              disabled={charging || !cartView.lines.length}
              className="btn-primary"
            >
              {charging ? "Charging..." : `Charge ${formatAud(paymentMethod === "cash" ? cartView.cashTotal : cartView.subtotal)}`}
            </button>
          </div>
          <button
            onClick={() => {
              const v = prompt("Order id for manager void");
              if (v) setVoidTarget(v.trim());
            }}
            className="btn-danger w-full"
          >
            Manager void
          </button>
          {toast && (
            <p className={`text-[11px] uppercase tracking-[0.14em] ${toast.kind === "ok" ? "text-bull" : "text-bear"}`}>
              {toast.msg}
            </p>
          )}
        </div>
      </aside>

      {tabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85">
          <div className="panel w-full max-w-sm">
            <h3 className="label">Open tab</h3>
            <input
              type="text"
              value={tabName}
              onChange={(e) => setTabName(e.target.value)}
              placeholder="Customer name or bar position"
              autoFocus
              className="mt-3 w-full rounded-sm px-3 py-2 text-sm"
            />
            <label className="mt-3 flex items-center gap-2 text-xs text-ink-dim">
              <input
                type="checkbox"
                checked={tabIdCheck}
                onChange={(e) => setTabIdCheck(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              I have checked photo ID on this customer
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setTabModal(false)} className="btn">Cancel</button>
              <button onClick={submitTab} className="btn-primary">Open</button>
            </div>
          </div>
        </div>
      )}

      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85">
          <div className="panel w-full max-w-sm">
            <h3 className="label">Manager void</h3>
            <p className="mt-1 num text-[11px] text-ink-dim">{voidTarget}</p>
            <input
              type="password"
              value={voidPin}
              onChange={(e) => setVoidPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Manager PIN"
              className="mt-3 w-full rounded-sm px-3 py-2 num"
            />
            <input
              type="text"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason"
              className="mt-2 w-full rounded-sm px-3 py-2 text-xs"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setVoidTarget(null)} className="btn">Cancel</button>
              <button onClick={voidOrder} className="btn-danger">Void</button>
            </div>
          </div>
        </div>
      )}

      {refusalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85">
          <div className="panel w-full max-w-sm">
            <h3 className="label">RSA refusal of service</h3>
            <label className="mt-3 block text-xs">
              <span className="label">Reason</span>
              <select
                value={refusalReason}
                onChange={(e) => setRefusalReason(e.target.value as typeof refusalReason)}
                className="mt-1 w-full rounded-sm px-3 py-2 text-sm"
              >
                <option value="intoxication">Intoxication</option>
                <option value="id">ID issue / minor</option>
                <option value="behaviour">Behaviour</option>
                <option value="other">Other</option>
              </select>
            </label>
            <textarea
              value={refusalNotes}
              onChange={(e) => setRefusalNotes(e.target.value)}
              placeholder="Notes for the audit log..."
              className="mt-2 w-full rounded-sm px-3 py-2 text-xs"
              rows={3}
              style={{ background: "#10161D", border: "1px solid #1A2027", color: "#E6E8EB" }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setRefusalOpen(false)} className="btn">Cancel</button>
              <button onClick={submitRefusal} className="btn-danger">Log refusal</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
