"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveState } from "@/lib/hooks/useLiveState";
import { formatAud, roundCashAud } from "@/lib/money";
import { Logo } from "@/components/Logo";
import { CrashBanner } from "@/components/CrashBanner";
import { QrImage } from "@/components/QrImage";
import type { DrinkCategory } from "@/lib/types";

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
    items: { drinkId: string; quantity: number; expectedUnitPrice: number }[];
    tabId?: string;
    receipt?: { channel: "email" | "sms"; to: string };
    idempotencyKey: string;
    idCheck?: boolean;
    cashTendered?: number;
    tipAmount?: number;
    discountAmount?: number;
    discountReason?: string;
    managerPin?: string;
  };
  attemptCount: number;
  lastAttemptAt: number;
}

interface Tab {
  id: string;
  notes: string | null;
  orderNumber: number;
  lines: { drinkId: string; drinkNameSnapshot: string; quantity: number; lineTotal: number }[];
  total: number;
  subtotal: number;
}

interface RecentOrder {
  id: string;
  orderNumber: number;
  total: number;
  status: string;
  createdAt: string;
  paymentMethod: string;
  lines: { drinkId: string; drinkNameSnapshot: string; quantity: number }[];
}

interface LastOrder {
  items: { drinkId: string; quantity: number }[];
  orderNumber: number;
  ts: number;
}

const QUEUE_KEY = "drink-exchange-pos-queue";
const STAFF_KEY = "drink-exchange-pos-staff";
const CART_KEY = "drink-exchange-pos-cart";
const ACTIVE_TAB_KEY = "drink-exchange-pos-active-tab";
const PAYMENT_METHOD_KEY = "drink-exchange-pos-pm";
const IDEMPOTENCY_KEY = "drink-exchange-pos-idem";
const LAST_ORDER_KEY = "drink-exchange-pos-last";
const QTY_PRESETS = [4, 6, 8];
const MAX_DRAIN_ATTEMPTS = 5;
const CLOSE_WARNING_MIN = 10;
const TIP_PRESETS = [0.1, 0.15, 0.2];

const ALL_CATEGORIES: (DrinkCategory | "All")[] = [
  "All",
  "Cocktails",
  "Beer",
  "Wine",
  "Spirits",
  "Shots",
  "Non-Alc",
];

function newIdempotencyKey() {
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseHM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map((n) => parseInt(n, 10));
  return { h: h ?? 0, m: m ?? 0 };
}

function adelaideMinutesNow(): number {
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Adelaide",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const hh = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const mm = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return hh * 60 + mm;
}

function isWithinTradingHoursClient(open: string, close: string): boolean {
  const cur = adelaideMinutesNow();
  const { h: oh, m: om } = parseHM(open);
  const { h: ch, m: cm } = parseHM(close);
  const o = oh * 60 + om;
  const c = ch * 60 + cm;
  if (o === c) return true;
  if (o < c) return cur >= o && cur < c;
  return cur >= o || cur < c;
}

function minutesUntilClose(close: string): number {
  const cur = adelaideMinutesNow();
  const { h: ch, m: cm } = parseHM(close);
  const c = ch * 60 + cm;
  let delta = c - cur;
  if (delta <= 0) delta += 24 * 60;
  return delta;
}

export function PosClient() {
  const { state, refresh } = useLiveState();
  const [pin, setPin] = useState("");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState<string | null>(null);
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

  // Filters
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<DrinkCategory | "All">("All");

  // Modals
  const [tabModal, setTabModal] = useState(false);
  const [tabName, setTabName] = useState("");
  const [tabIdCheck, setTabIdCheck] = useState(false);

  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voidPin, setVoidPin] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [voidPickerOpen, setVoidPickerOpen] = useState(false);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const [refundTarget, setRefundTarget] = useState<RecentOrder | null>(null);
  const [refundPin, setRefundPin] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundPickerOpen, setRefundPickerOpen] = useState(false);

  const [refusalOpen, setRefusalOpen] = useState(false);
  const [refusalReason, setRefusalReason] = useState<"intoxication" | "id" | "behaviour" | "other">(
    "intoxication",
  );
  const [refusalNotes, setRefusalNotes] = useState("");
  const [refusalPin, setRefusalPin] = useState("");

  const [cashOpen, setCashOpen] = useState(false);
  const [cashInput, setCashInput] = useState("");

  const [tipOpen, setTipOpen] = useState(false);
  const [tipCustom, setTipCustom] = useState("");

  const [compOpen, setCompOpen] = useState(false);
  const [compMode, setCompMode] = useState<"$" | "%">("$");
  const [compInput, setCompInput] = useState("");
  const [compReason, setCompReason] = useState("");
  const [compPin, setCompPin] = useState("");
  const [pendingDiscount, setPendingDiscount] = useState<{
    amount: number;
    reason: string;
    managerPin: string;
  } | null>(null);

  const [outOfStockTarget, setOutOfStockTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [outOfStockPin, setOutOfStockPin] = useState("");

  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);

  const [successOpen, setSuccessOpen] = useState<{
    id: string;
    orderNumber: number;
    total: number;
    change: number | null;
  } | null>(null);

  // Clock tick for closing countdown.
  const [, setClockTick] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);
  const chargingRef = useRef(false);
  const drainRef = useRef(false);
  const idempotencyRef = useRef<string | null>(null);

  // Boot from localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sid = window.localStorage.getItem(STAFF_KEY);
      if (sid) {
        const parsed = JSON.parse(sid) as { id: string; role: string };
        setStaffId(parsed.id);
        setStaffRole(parsed.role);
      }
      const c = window.localStorage.getItem(CART_KEY);
      if (c) setCart(JSON.parse(c));
      const at = window.localStorage.getItem(ACTIVE_TAB_KEY);
      if (at) setActiveTabId(at);
      const pm = window.localStorage.getItem(PAYMENT_METHOD_KEY);
      if (pm === "cash" || pm === "card") setPaymentMethod(pm);
      const idem = window.localStorage.getItem(IDEMPOTENCY_KEY);
      if (idem) idempotencyRef.current = idem;
      const q = window.localStorage.getItem(QUEUE_KEY);
      if (q) setQueue(JSON.parse(q));
      const last = window.localStorage.getItem(LAST_ORDER_KEY);
      if (last) setLastOrder(JSON.parse(last));
    } catch {
      // ignore
    }
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const tick = setInterval(() => setClockTick((x) => x + 1), 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (staffId) {
      window.localStorage.setItem(STAFF_KEY, JSON.stringify({ id: staffId, role: staffRole }));
    } else {
      window.localStorage.removeItem(STAFF_KEY);
    }
  }, [staffId, staffRole]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeTabId) window.localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
    else window.localStorage.removeItem(ACTIVE_TAB_KEY);
  }, [activeTabId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PAYMENT_METHOD_KEY, paymentMethod);
  }, [paymentMethod]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }, [queue]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lastOrder) window.localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(lastOrder));
  }, [lastOrder]);

  // Drain offline queue.
  useEffect(() => {
    if (!online || queue.length === 0) return;
    if (drainRef.current) return;

    let cancelled = false;
    const run = async () => {
      drainRef.current = true;
      try {
        const items = [...queue];
        for (const q of items) {
          if (cancelled) break;
          if (q.attemptCount >= MAX_DRAIN_ATTEMPTS) {
            setToast({
              kind: "err",
              msg: `Dropped queued order after ${MAX_DRAIN_ATTEMPTS} retries`,
            });
            setQueue((cur) => cur.filter((x) => x.id !== q.id));
            continue;
          }
          if (q.attemptCount > 0) {
            const backoffMs = Math.min(16_000, 2_000 * 2 ** (q.attemptCount - 1));
            if (Date.now() - q.lastAttemptAt < backoffMs) continue;
          }
          try {
            const res = await fetch("/api/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(q.body),
            });
            if (res.ok) {
              setQueue((cur) => cur.filter((x) => x.id !== q.id));
            } else if (res.status === 422) {
              const data = await res.json().catch(() => ({}));
              setToast({
                kind: "err",
                msg: `Queued order rejected: ${data.reason ?? "unknown"}`,
              });
              setQueue((cur) => cur.filter((x) => x.id !== q.id));
            } else {
              setQueue((cur) =>
                cur.map((x) =>
                  x.id === q.id
                    ? { ...x, attemptCount: x.attemptCount + 1, lastAttemptAt: Date.now() }
                    : x,
                ),
              );
            }
          } catch {
            setQueue((cur) =>
              cur.map((x) =>
                x.id === q.id
                  ? { ...x, attemptCount: x.attemptCount + 1, lastAttemptAt: Date.now() }
                  : x,
              ),
            );
            break;
          }
        }
      } finally {
        drainRef.current = false;
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [online, queue]);

  // Tabs polling.
  useEffect(() => {
    if (!staffId || !online) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/tabs", { cache: "no-store" });
        if (!alive) return;
        if (res.ok) {
          const data = await res.json();
          setOpenTabs(
            (data.tabs ?? []).map((t: Tab) => ({
              ...t,
              subtotal: t.subtotal ?? t.total,
            })),
          );
        }
      } catch {
        // ignore
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [staffId, online]);

  const crashActive = state?.crash.active ?? false;
  const crashEvent = state?.crash.event;
  const crashRemaining = state?.crash.remainingSeconds ?? 0;
  const discount = crashEvent?.discountPercent ?? 0;
  const floor = state?.settings.minMarginMultiplier ?? 0.3;

  const tradingClose = state?.settings.tradingClose;
  const tradingOpenSetting = state?.settings.tradingOpen;
  const isOpen = useMemo(() => {
    if (!tradingOpenSetting || !tradingClose) return true;
    return isWithinTradingHoursClient(tradingOpenSetting, tradingClose);
  }, [tradingOpenSetting, tradingClose]);
  const minsToClose = useMemo(() => {
    if (!tradingClose || !isOpen) return null;
    return minutesUntilClose(tradingClose);
  }, [tradingClose, isOpen]);

  const activeTab = useMemo(
    () => openTabs.find((t) => t.id === activeTabId) ?? null,
    [openTabs, activeTabId],
  );

  const cartView = useMemo(() => {
    if (!state) {
      return {
        lines: [] as (CartLine & { liveUnit: number; lineTotal: number; moved: boolean })[],
        newSubtotal: 0,
        tabSubtotal: 0,
        combinedSubtotal: 0,
        discountAmount: 0,
        afterDiscountSubtotal: 0,
        cashTotal: 0,
      };
    }
    const lines = cart.map((l) => {
      const d = state.drinks.find((x) => x.id === l.drinkId);
      const live = d
        ? d.isDynamic && crashActive
          ? Math.max(d.currentPrice * (1 - discount), d.costPrice * (1 + floor))
          : d.currentPrice
        : l.unit;
      const liveUnit = Math.round(live * 100) / 100;
      const lineTotal = Math.round(l.unit * l.quantity * 100) / 100;
      const moved = Math.abs(liveUnit - l.unit) > 0.01;
      return { ...l, liveUnit, lineTotal, moved };
    });
    const newSubtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
    const tabSubtotal = activeTab ? Math.round(activeTab.subtotal * 100) / 100 : 0;
    const combinedSubtotal = Math.round((newSubtotal + tabSubtotal) * 100) / 100;
    const discountAmount = pendingDiscount
      ? Math.min(pendingDiscount.amount, combinedSubtotal)
      : 0;
    const afterDiscountSubtotal = Math.round((combinedSubtotal - discountAmount) * 100) / 100;
    return {
      lines,
      newSubtotal,
      tabSubtotal,
      combinedSubtotal,
      discountAmount,
      afterDiscountSubtotal,
      cashTotal: roundCashAud(afterDiscountSubtotal),
    };
  }, [cart, state, crashActive, discount, floor, activeTab, pendingDiscount]);

  const filteredDrinks = useMemo(() => {
    if (!state) return [];
    const q = search.trim().toLowerCase();
    return state.drinks.filter((d) => {
      if (activeCategory !== "All" && d.category !== activeCategory) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.ticker.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
      );
    });
  }, [state, search, activeCategory]);

  const ensureIdempotencyKey = useCallback(() => {
    if (!idempotencyRef.current) {
      const k = newIdempotencyKey();
      idempotencyRef.current = k;
      if (typeof window !== "undefined") window.localStorage.setItem(IDEMPOTENCY_KEY, k);
    }
    return idempotencyRef.current;
  }, []);

  const clearIdempotencyKey = useCallback(() => {
    idempotencyRef.current = null;
    if (typeof window !== "undefined") window.localStorage.removeItem(IDEMPOTENCY_KEY);
  }, []);

  if (!staffId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-6">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
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
              setStaffRole(data.staff.role ?? null);
              setPin("");
              setPinError(null);
            } catch {
              setPinError("Network error - try again");
            }
          }}
          className="panel-brass frame-deco w-full max-w-sm"
        >
          <div className="flex flex-col items-center gap-2">
            <Logo size={20} variant="stacked" />
          </div>
          <div className="brand-divider mt-4" />
          <h1 className="mt-4 text-center text-xs uppercase tracking-[0.32em] text-brass">
            Staff terminal
          </h1>
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
          {pinError && (
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-bear">{pinError}</p>
          )}
        </form>
      </main>
    );
  }

  if (!state) return <div className="p-10 text-ink-dim">Connecting...</div>;

  const signOut = () => {
    setStaffId(null);
    setStaffRole(null);
  };

  const addToCart = (drinkId: string, ticker: string, name: string, unit: number, qty = 1) => {
    ensureIdempotencyKey();
    setCart((c) => {
      const ex = c.find((l) => l.drinkId === drinkId);
      if (ex) {
        return c.map((l) => (l.drinkId === drinkId ? { ...l, quantity: l.quantity + qty } : l));
      }
      return [...c, { drinkId, ticker, name, unit, quantity: qty }];
    });
  };

  const setQuantity = (drinkId: string, qty: number) => {
    if (qty <= 0) setCart((c) => c.filter((l) => l.drinkId !== drinkId));
    else if (qty > 99) setCart((c) => c.map((l) => (l.drinkId === drinkId ? { ...l, quantity: 99 } : l)));
    else setCart((c) => c.map((l) => (l.drinkId === drinkId ? { ...l, quantity: qty } : l)));
  };

  const requoteCart = () => {
    if (!state) return;
    setCart((c) =>
      c.map((l) => {
        const d = state.drinks.find((x) => x.id === l.drinkId);
        if (!d) return l;
        const live =
          d.isDynamic && crashActive
            ? Math.max(d.currentPrice * (1 - discount), d.costPrice * (1 + floor))
            : d.currentPrice;
        return { ...l, unit: Math.round(live * 100) / 100 };
      }),
    );
  };

  const repeatLastOrder = () => {
    if (!lastOrder || !state) return;
    const newCart: CartLine[] = [];
    for (const item of lastOrder.items) {
      const d = state.drinks.find((x) => x.id === item.drinkId);
      if (!d || !d.isActive) continue;
      const live = roundCashAud(
        d.isDynamic && crashActive
          ? Math.max(d.currentPrice * (1 - discount), d.costPrice * (1 + floor))
          : d.currentPrice,
      );
      newCart.push({
        drinkId: d.id,
        ticker: d.ticker,
        name: d.name,
        unit: Math.round(d.displayPrice * 100) / 100,
        quantity: item.quantity,
      });
      // (live used to mute lint; intentionally unused here)
      void live;
    }
    if (!newCart.length) {
      setToast({ kind: "err", msg: "Last order's drinks are no longer available" });
      return;
    }
    setCart(newCart);
    setActiveTabId(null);
    ensureIdempotencyKey();
    setToast({ kind: "ok", msg: `Loaded last order (#${lastOrder.orderNumber})` });
  };

  const sendOrder = async (opts?: { cashTendered?: number; tipAmount?: number }) => {
    if (!cartView.lines.length && !activeTabId) return;
    if (chargingRef.current) return;
    chargingRef.current = true;
    setCharging(true);

    const idempotencyKey = ensureIdempotencyKey();
    const body = {
      staffId,
      paymentMethod,
      items: cartView.lines.map((l) => ({
        drinkId: l.drinkId,
        quantity: l.quantity,
        expectedUnitPrice: l.unit,
      })),
      tabId: activeTabId ?? undefined,
      receipt: receiptTo
        ? { channel: receiptTo.includes("@") ? ("email" as const) : ("sms" as const), to: receiptTo }
        : undefined,
      idempotencyKey,
      cashTendered: paymentMethod === "cash" ? opts?.cashTendered : undefined,
      tipAmount: paymentMethod === "card" ? opts?.tipAmount : undefined,
      discountAmount: pendingDiscount?.amount,
      discountReason: pendingDiscount?.reason,
      managerPin: pendingDiscount?.managerPin,
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
        // Remember last order for "Repeat last".
        setLastOrder({
          items: cartView.lines.map((l) => ({ drinkId: l.drinkId, quantity: l.quantity })),
          orderNumber: data.order.orderNumber,
          ts: Date.now(),
        });
        const change =
          paymentMethod === "cash" && typeof opts?.cashTendered === "number"
            ? Math.max(0, opts.cashTendered - data.order.total)
            : null;
        setSuccessOpen({
          id: data.order.id,
          orderNumber: data.order.orderNumber,
          total: data.order.total,
          change,
        });
        setCart([]);
        setActiveTabId(null);
        setReceiptTo("");
        setPendingDiscount(null);
        clearIdempotencyKey();
        refresh();
      }
    } catch {
      const queued: QueuedOrder = {
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        body: { ...body, staffId: staffId! },
        attemptCount: 0,
        lastAttemptAt: 0,
      };
      setQueue((q) => [...q, queued]);
      setToast({ kind: "ok", msg: "Queued offline · will send on reconnect" });
      setCart([]);
      setActiveTabId(null);
      setPendingDiscount(null);
      clearIdempotencyKey();
    } finally {
      chargingRef.current = false;
      setCharging(false);
    }
  };

  const onChargePressed = () => {
    if (!isOpen) {
      setToast({ kind: "err", msg: "Market is closed - no orders" });
      return;
    }
    if (paymentMethod === "cash") {
      setCashInput("");
      setCashOpen(true);
    } else {
      setTipCustom("");
      setTipOpen(true);
    }
  };

  const confirmCashTendered = () => {
    const v = parseFloat(cashInput);
    if (!Number.isFinite(v) || v < cartView.cashTotal) {
      setToast({ kind: "err", msg: `Tendered must be ≥ ${formatAud(cartView.cashTotal)}` });
      return;
    }
    setCashOpen(false);
    sendOrder({ cashTendered: v });
  };

  const confirmTip = (tipAmount: number) => {
    setTipOpen(false);
    sendOrder({ tipAmount });
  };

  const saveAsTab = () => {
    if (!cartView.lines.length) return;
    setTabModal(true);
  };

  const submitTab = async () => {
    const name = tabName.trim() || "Tab";
    try {
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
            items: cartView.lines.map((l) => ({
              drinkId: l.drinkId,
              quantity: l.quantity,
              expectedUnitPrice: l.unit,
            })),
          }),
        });
      }
      setToast({
        kind: "ok",
        msg: `Tab "${name}" opened · ID ${tabIdCheck ? "checked" : "NOT checked"}`,
      });
      setCart([]);
      clearIdempotencyKey();
      setTabName("");
      setTabIdCheck(false);
      setTabModal(false);
    } catch {
      setToast({ kind: "err", msg: "Network error opening tab" });
    }
  };

  const resumeTab = (tab: Tab) => {
    setActiveTabId(tab.id);
    setCart([]);
    setPendingDiscount(null);
    clearIdempotencyKey();
    ensureIdempotencyKey();
    setToast({ kind: "ok", msg: `Resumed tab #${tab.orderNumber}` });
  };

  const exitTab = () => {
    setActiveTabId(null);
    setCart([]);
    setPendingDiscount(null);
    clearIdempotencyKey();
  };

  const loadRecentOrders = async () => {
    setRecentLoading(true);
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      const data = await res.json();
      const list: RecentOrder[] = (data.orders ?? [])
        .filter((o: RecentOrder) => o.status === "paid")
        .slice(0, 30);
      setRecentOrders(list);
    } catch {
      setRecentOrders([]);
    } finally {
      setRecentLoading(false);
    }
  };

  const openVoidPicker = () => {
    setVoidPickerOpen(true);
    loadRecentOrders();
  };

  const openRefundPicker = () => {
    setRefundPickerOpen(true);
    loadRecentOrders();
  };

  const voidOrder = async () => {
    if (!voidTarget) return;
    try {
      const res = await fetch(`/api/orders/${voidTarget}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: voidPin, reason: voidReason || "manager void" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setToast({ kind: "err", msg: data.reason ?? "Void failed" });
      } else {
        setToast({ kind: "ok", msg: `Order voided · ${formatAud(data.order.total)}` });
      }
    } catch {
      setToast({ kind: "err", msg: "Network error during void" });
    }
    setVoidTarget(null);
    setVoidPin("");
    setVoidReason("");
  };

  const submitRefund = async () => {
    if (!refundTarget) return;
    const amount = parseFloat(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setToast({ kind: "err", msg: "Amount must be > 0" });
      return;
    }
    try {
      const res = await fetch(`/api/orders/${refundTarget.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: refundPin, amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setToast({ kind: "err", msg: data.reason ?? "Refund failed" });
      } else {
        setToast({ kind: "ok", msg: `Refunded ${formatAud(amount)} on #${data.order.orderNumber}` });
        setRefundTarget(null);
        setRefundPin("");
        setRefundAmount("");
      }
    } catch {
      setToast({ kind: "err", msg: "Network error during refund" });
    }
  };

  const submitRefusal = async () => {
    if (!refusalPin) {
      setToast({ kind: "err", msg: "PIN required to log refusal" });
      return;
    }
    try {
      const res = await fetch("/api/refusal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: refusalPin,
          reason: refusalReason,
          notes: refusalNotes || "—",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setToast({ kind: "err", msg: data.reason ?? "Refusal logging failed" });
      } else {
        setToast({ kind: "ok", msg: "Refusal logged" });
        setRefusalNotes("");
      }
    } catch {
      setToast({ kind: "err", msg: "Network error logging refusal" });
    }
    setRefusalOpen(false);
    setRefusalPin("");
  };

  const submitComp = () => {
    const value = parseFloat(compInput);
    if (!Number.isFinite(value) || value <= 0) {
      setToast({ kind: "err", msg: "Comp amount must be > 0" });
      return;
    }
    if (!compReason.trim()) {
      setToast({ kind: "err", msg: "Reason required" });
      return;
    }
    if (!compPin) {
      setToast({ kind: "err", msg: "Manager PIN required" });
      return;
    }
    const amount =
      compMode === "%"
        ? Math.round(cartView.combinedSubtotal * (value / 100) * 100) / 100
        : Math.min(value, cartView.combinedSubtotal);
    setPendingDiscount({ amount, reason: compReason.trim(), managerPin: compPin });
    setCompOpen(false);
    setCompInput("");
    setCompReason("");
    setCompPin("");
    setToast({ kind: "ok", msg: `Comp applied: −${formatAud(amount)}` });
  };

  const submitOutOfStock = async () => {
    if (!outOfStockTarget || !outOfStockPin) {
      setToast({ kind: "err", msg: "Manager PIN required" });
      return;
    }
    // Verify PIN via the auth endpoint (manager-or-above).
    try {
      const authRes = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: outOfStockPin }),
      });
      const authData = await authRes.json();
      if (
        !authRes.ok ||
        !authData.ok ||
        !["manager", "admin", "owner"].includes(authData.staff?.role)
      ) {
        setToast({ kind: "err", msg: "Manager PIN required" });
        return;
      }
      const res = await fetch("/api/drinks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: outOfStockTarget.id, isActive: false }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setToast({ kind: "err", msg: data.reason ?? "Could not 86 drink" });
      } else {
        setToast({ kind: "ok", msg: `${outOfStockTarget.name} is out of stock` });
      }
    } catch {
      setToast({ kind: "err", msg: "Network error" });
    }
    setOutOfStockTarget(null);
    setOutOfStockPin("");
  };

  const cashRoundDelta = cartView.cashTotal - cartView.afterDiscountSubtotal;

  return (
    <main className="grid h-screen grid-cols-[1fr_22rem] bg-bg">
      <section className="overflow-y-auto p-3">
        {crashActive && (
          <div className="mb-2">
            <CrashBanner
              active={crashActive}
              discountPercent={discount}
              remainingSeconds={crashRemaining}
              triggeredVia={crashEvent?.triggeredVia}
            />
          </div>
        )}
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
              <span className="pill border-amber/40 text-amber">
                Offline · queued {queue.length}
              </span>
            )}
            {state.connectionStatus !== "live" && online && (
              <span className="pill border-amber/40 text-amber">
                {state.connectionStatus.toUpperCase()}
              </span>
            )}
            {!isOpen && <span className="pill border-bear/40 text-bear">Market closed</span>}
            {isOpen && minsToClose !== null && minsToClose <= CLOSE_WARNING_MIN && (
              <span className="pill border-amber/40 text-amber">Close in {minsToClose}m</span>
            )}
            <button className="btn" onClick={() => setRefusalOpen(true)}>RSA refuse</button>
            <button className="btn" onClick={signOut}>Sign out</button>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-1">
          {ALL_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`btn px-2 py-1 text-[10px] ${
                activeCategory === c ? "border-bull text-bull" : ""
              }`}
            >
              {c}
            </button>
          ))}
          {lastOrder && (
            <button
              onClick={repeatLastOrder}
              className="btn ml-auto px-2 py-1 text-[10px]"
              title={`Reorder items from #${lastOrder.orderNumber}`}
            >
              ↻ Repeat last (#{lastOrder.orderNumber})
            </button>
          )}
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
              <div
                key={d.id}
                className="panel-tight relative flex flex-col gap-2 text-left transition active:scale-[0.98]"
              >
                <button
                  onClick={() => addToCart(d.id, d.ticker, d.name, unit)}
                  disabled={!isOpen}
                  className="flex w-full flex-col text-left disabled:opacity-40"
                >
                  <div className="text-sm font-semibold leading-tight">{d.name}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="ticker-symbol">{d.ticker}</span>
                    <span className="label">{d.category}</span>
                  </div>
                  <div
                    className={`mt-2 num text-xl font-semibold ${
                      crashActive && d.isDynamic ? "text-bear" : ""
                    }`}
                  >
                    {formatAud(unit)}
                  </div>
                </button>
                <div className="flex gap-1">
                  {QTY_PRESETS.map((n) => (
                    <button
                      key={n}
                      onClick={() => addToCart(d.id, d.ticker, d.name, unit, n)}
                      disabled={!isOpen}
                      className="btn flex-1 px-0 py-0.5 text-[10px] disabled:opacity-40"
                    >
                      +{n}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setOutOfStockTarget({ id: d.id, name: d.name })}
                  className="absolute right-1 top-1 rounded-sm border border-edge px-1 py-0 text-[9px] uppercase tracking-[0.18em] text-ink-dim hover:border-bear hover:text-bear"
                  title="86 this drink"
                >
                  86
                </button>
              </div>
            );
          })}
          {filteredDrinks.length === 0 && (
            <div className="col-span-full num text-[11px] uppercase tracking-[0.18em] text-ink-dim">
              [ no drinks match ]
            </div>
          )}
        </div>
      </section>

      <aside className="flex flex-col border-l border-edge bg-bg-card p-3">
        <div className="flex items-center justify-between">
          <h2 className="label text-ink">
            Cart {activeTabId && <span className="ml-2 text-bull">· on tab</span>}
          </h2>
          <div className="flex items-center gap-2">
            <button
              className="text-[10px] uppercase tracking-[0.18em] text-ink-dim hover:text-amber disabled:opacity-30"
              onClick={requoteCart}
              disabled={!cart.length}
            >
              re-quote
            </button>
            <button
              className="text-[10px] uppercase tracking-[0.18em] text-ink-dim hover:text-bear"
              onClick={() => {
                setCart([]);
                setPendingDiscount(null);
                if (activeTabId) exitTab();
                clearIdempotencyKey();
              }}
            >
              clear
            </button>
          </div>
        </div>

        {activeTab && activeTab.lines.length > 0 && (
          <div className="mt-3 rounded-sm border border-bull/30 bg-bull/5 p-2">
            <div className="label text-bull">
              Tab #{activeTab.orderNumber} · {activeTab.notes ?? "tab"}
            </div>
            <ul className="mt-1 space-y-0.5 text-[11px]">
              {activeTab.lines.map((l, i) => (
                <li key={i} className="flex justify-between text-ink/80">
                  <span>
                    <span className="num">{l.quantity}x</span> {l.drinkNameSnapshot}
                  </span>
                  <span className="num">{formatAud(l.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-bull">
              <span>Existing tab total</span>
              <span className="num">{formatAud(cartView.tabSubtotal)}</span>
            </div>
            <button
              onClick={exitTab}
              className="mt-2 text-[10px] uppercase tracking-[0.18em] text-ink-dim hover:text-bear"
            >
              exit tab (don't close)
            </button>
          </div>
        )}

        <div className="mt-3 flex-1 overflow-y-auto space-y-2">
          {cartView.lines.length === 0 && !activeTab && (
            <p className="num text-[11px] uppercase tracking-[0.18em] text-ink-dim">[ empty ]</p>
          )}
          {cartView.lines.length === 0 && activeTab && (
            <p className="num text-[11px] uppercase tracking-[0.18em] text-ink-dim">
              [ add more items, then charge to close tab ]
            </p>
          )}
          {cartView.lines.map((l) => (
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
                  <button className="btn px-2 py-0.5" onClick={() => setQuantity(l.drinkId, l.quantity - 1)}>-</button>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={l.quantity}
                    onChange={(e) => setQuantity(l.drinkId, parseInt(e.target.value, 10) || 0)}
                    className="w-10 rounded-sm px-1 py-0.5 num text-center"
                  />
                  <button className="btn px-2 py-0.5" onClick={() => setQuantity(l.drinkId, l.quantity + 1)}>+</button>
                </div>
                <div className={`num ${l.moved ? "text-amber" : "text-ink-dim"}`}>
                  {l.moved
                    ? `quoted ${formatAud(l.unit)} · now ${formatAud(l.liveUnit)}/u`
                    : `${formatAud(l.unit)}/u`}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-2 border-t border-edge pt-3">
          {activeTab && cartView.newSubtotal > 0 && (
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-ink-dim">
              <span>New items</span>
              <span className="num">{formatAud(cartView.newSubtotal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-ink-dim">
            <span>Subtotal · inc GST</span>
            <span className="num text-base font-semibold text-ink">
              {formatAud(cartView.combinedSubtotal)}
            </span>
          </div>
          {pendingDiscount && cartView.discountAmount > 0 && (
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-bull">
              <span title={pendingDiscount.reason}>Comp · {pendingDiscount.reason}</span>
              <button
                onClick={() => setPendingDiscount(null)}
                className="num hover:text-bear"
                title="Remove comp"
              >
                −{formatAud(cartView.discountAmount)} ×
              </button>
            </div>
          )}
          {pendingDiscount && (
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-ink-dim">
              <span>After comp</span>
              <span className="num">{formatAud(cartView.afterDiscountSubtotal)}</span>
            </div>
          )}
          {paymentMethod === "cash" && Math.abs(cashRoundDelta) > 0.001 && (
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-amber">
              <span>Cash · 5c round {cashRoundDelta > 0 ? "up" : "down"}</span>
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
            <button
              onClick={saveAsTab}
              disabled={!cartView.lines.length || !!activeTabId}
              className="btn disabled:opacity-40"
            >
              Save as tab
            </button>
            <button
              onClick={onChargePressed}
              disabled={charging || !isOpen || (!cartView.lines.length && !activeTabId)}
              className="btn-primary disabled:opacity-40"
            >
              {charging
                ? "Charging..."
                : !isOpen
                  ? "Market closed"
                  : `Charge ${formatAud(
                      paymentMethod === "cash"
                        ? cartView.cashTotal
                        : cartView.afterDiscountSubtotal,
                    )}`}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setCompOpen(true)}
              disabled={!cartView.combinedSubtotal}
              className="btn disabled:opacity-40"
            >
              Comp
            </button>
            <button onClick={openRefundPicker} className="btn">
              Refund
            </button>
            <button onClick={openVoidPicker} className="btn-danger">
              Void
            </button>
          </div>
          {toast && (
            <p
              className={`text-[11px] uppercase tracking-[0.14em] ${
                toast.kind === "ok" ? "text-bull" : "text-bear"
              }`}
            >
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

      {voidPickerOpen && (
        <PickerModal
          title="Manager void · pick an order"
          recentOrders={recentOrders}
          recentLoading={recentLoading}
          onPick={(o) => {
            setVoidTarget(o.id);
            setVoidPickerOpen(false);
          }}
          onClose={() => setVoidPickerOpen(false)}
          onRefresh={loadRecentOrders}
        />
      )}

      {refundPickerOpen && (
        <PickerModal
          title="Refund · pick an order"
          recentOrders={recentOrders}
          recentLoading={recentLoading}
          onPick={(o) => {
            setRefundTarget(o);
            setRefundAmount(o.total.toFixed(2));
            setRefundPickerOpen(false);
          }}
          onClose={() => setRefundPickerOpen(false)}
          onRefresh={loadRecentOrders}
        />
      )}

      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85">
          <div className="panel w-full max-w-sm">
            <h3 className="label">Manager void</h3>
            <p className="mt-1 num text-[11px] text-ink-dim">{voidTarget.slice(-10)}</p>
            <input
              type="password"
              inputMode="numeric"
              value={voidPin}
              onChange={(e) => setVoidPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Manager PIN"
              className="mt-3 w-full rounded-sm px-3 py-2 num"
              autoFocus
            />
            <input
              type="text"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason"
              className="mt-2 w-full rounded-sm px-3 py-2 text-xs"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setVoidTarget(null);
                  setVoidPin("");
                  setVoidReason("");
                }}
                className="btn"
              >
                Cancel
              </button>
              <button onClick={voidOrder} className="btn-danger">Void</button>
            </div>
          </div>
        </div>
      )}

      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85">
          <div className="panel w-full max-w-sm">
            <h3 className="label">Refund order #{refundTarget.orderNumber}</h3>
            <p className="mt-1 text-[11px] text-ink-dim">
              Paid {formatAud(refundTarget.total)} · {refundTarget.paymentMethod}
            </p>
            <label className="mt-3 block text-xs">
              <span className="label">Amount to refund</span>
              <input
                type="number"
                step="0.5"
                min="0"
                max={refundTarget.total}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="mt-1 w-full rounded-sm px-3 py-2 num"
                autoFocus
              />
              <div className="mt-1 flex gap-1">
                {[0.25, 0.5, 0.75, 1].map((frac) => (
                  <button
                    key={frac}
                    onClick={() => setRefundAmount((refundTarget.total * frac).toFixed(2))}
                    className="btn flex-1 px-1 py-0.5 text-[10px]"
                  >
                    {frac === 1 ? "Full" : `${Math.round(frac * 100)}%`}
                  </button>
                ))}
              </div>
            </label>
            <label className="mt-2 block text-xs">
              <span className="label">Manager PIN</span>
              <input
                type="password"
                inputMode="numeric"
                value={refundPin}
                onChange={(e) => setRefundPin(e.target.value.replace(/\D/g, ""))}
                className="mt-1 w-full rounded-sm px-3 py-2 num"
              />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setRefundTarget(null);
                  setRefundPin("");
                  setRefundAmount("");
                }}
                className="btn"
              >
                Cancel
              </button>
              <button onClick={submitRefund} className="btn-danger">Refund</button>
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
            <label className="mt-2 block text-xs">
              <span className="label">Your PIN</span>
              <input
                type="password"
                inputMode="numeric"
                value={refusalPin}
                onChange={(e) => setRefusalPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="mt-1 w-full rounded-sm px-3 py-2 num"
              />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { setRefusalOpen(false); setRefusalPin(""); }} className="btn">
                Cancel
              </button>
              <button onClick={submitRefusal} className="btn-danger">Log refusal</button>
            </div>
          </div>
        </div>
      )}

      {cashOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85">
          <div className="panel w-full max-w-sm">
            <h3 className="label">Cash tendered</h3>
            <div className="mt-2 flex items-center justify-between text-xs text-ink-dim">
              <span>Total due</span>
              <span className="num text-lg font-semibold text-ink">
                {formatAud(cartView.cashTotal)}
              </span>
            </div>
            <input
              type="number"
              inputMode="decimal"
              step="0.05"
              min={cartView.cashTotal}
              value={cashInput}
              onChange={(e) => setCashInput(e.target.value)}
              placeholder={`${cartView.cashTotal.toFixed(2)}`}
              autoFocus
              className="mt-3 w-full rounded-sm px-3 py-2 num text-xl"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {[
                cartView.cashTotal,
                Math.ceil(cartView.cashTotal / 5) * 5,
                Math.ceil(cartView.cashTotal / 10) * 10,
                Math.ceil(cartView.cashTotal / 20) * 20,
                Math.ceil(cartView.cashTotal / 50) * 50,
              ]
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((v) => (
                  <button
                    key={v}
                    onClick={() => setCashInput(v.toFixed(2))}
                    className="btn flex-1 px-2 py-1 text-[11px]"
                  >
                    {formatAud(v)}
                  </button>
                ))}
            </div>
            {parseFloat(cashInput) >= cartView.cashTotal && (
              <div className="mt-3 flex items-center justify-between text-xs text-bull">
                <span className="label">Change due</span>
                <span className="num text-lg font-semibold">
                  {formatAud(parseFloat(cashInput) - cartView.cashTotal)}
                </span>
              </div>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { setCashOpen(false); setCashInput(""); }} className="btn">
                Cancel
              </button>
              <button onClick={confirmCashTendered} className="btn-primary">Confirm &amp; charge</button>
            </div>
          </div>
        </div>
      )}

      {tipOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85">
          <div className="panel w-full max-w-sm">
            <h3 className="label">Add a tip?</h3>
            <p className="mt-2 text-xs text-ink-dim">
              Charge total: {formatAud(cartView.afterDiscountSubtotal)}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {TIP_PRESETS.map((p) => {
                const tip = Math.round(cartView.afterDiscountSubtotal * p * 100) / 100;
                return (
                  <button
                    key={p}
                    onClick={() => confirmTip(tip)}
                    className="btn flex flex-col items-center gap-0.5 py-2"
                  >
                    <span className="text-base font-semibold">{Math.round(p * 100)}%</span>
                    <span className="num text-[10px] text-ink-dim">{formatAud(tip)}</span>
                  </button>
                );
              })}
            </div>
            <label className="mt-3 block text-xs">
              <span className="label">Custom tip ($)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={tipCustom}
                onChange={(e) => setTipCustom(e.target.value)}
                className="mt-1 w-full rounded-sm px-3 py-2 num"
              />
            </label>
            <div className="mt-3 flex justify-between gap-2">
              <button onClick={() => confirmTip(0)} className="btn flex-1">No tip</button>
              <button
                onClick={() => {
                  const t = parseFloat(tipCustom);
                  confirmTip(Number.isFinite(t) && t > 0 ? t : 0);
                }}
                className="btn-primary flex-1"
              >
                Charge {formatAud(cartView.afterDiscountSubtotal + (parseFloat(tipCustom) || 0))}
              </button>
            </div>
          </div>
        </div>
      )}

      {compOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85">
          <div className="panel w-full max-w-sm">
            <h3 className="label">Comp / discount</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setCompMode("$")}
                className={`btn ${compMode === "$" ? "border-bull text-bull" : ""}`}
              >
                $ off
              </button>
              <button
                onClick={() => setCompMode("%")}
                className={`btn ${compMode === "%" ? "border-bull text-bull" : ""}`}
              >
                % off
              </button>
            </div>
            <input
              type="number"
              inputMode="decimal"
              step={compMode === "%" ? "5" : "1"}
              min="0"
              max={compMode === "%" ? 100 : cartView.combinedSubtotal}
              value={compInput}
              onChange={(e) => setCompInput(e.target.value)}
              placeholder={compMode === "%" ? "10" : "5.00"}
              autoFocus
              className="mt-2 w-full rounded-sm px-3 py-2 num text-xl"
            />
            <input
              type="text"
              value={compReason}
              onChange={(e) => setCompReason(e.target.value)}
              placeholder="Reason (required)"
              className="mt-2 w-full rounded-sm px-3 py-2 text-xs"
            />
            <label className="mt-2 block text-xs">
              <span className="label">Manager PIN</span>
              <input
                type="password"
                inputMode="numeric"
                value={compPin}
                onChange={(e) => setCompPin(e.target.value.replace(/\D/g, ""))}
                className="mt-1 w-full rounded-sm px-3 py-2 num"
              />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setCompOpen(false);
                  setCompInput("");
                  setCompReason("");
                  setCompPin("");
                }}
                className="btn"
              >
                Cancel
              </button>
              <button onClick={submitComp} className="btn-primary">Apply</button>
            </div>
          </div>
        </div>
      )}

      {outOfStockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85">
          <div className="panel w-full max-w-sm">
            <h3 className="label">86 · out of stock</h3>
            <p className="mt-2 text-sm">
              Mark <span className="font-semibold">{outOfStockTarget.name}</span> as out of stock?
            </p>
            <p className="mt-1 text-[10px] text-ink-dim">
              It vanishes from POS, tickers, and display until re-enabled in admin.
            </p>
            <label className="mt-3 block text-xs">
              <span className="label">Manager PIN</span>
              <input
                type="password"
                inputMode="numeric"
                value={outOfStockPin}
                onChange={(e) => setOutOfStockPin(e.target.value.replace(/\D/g, ""))}
                className="mt-1 w-full rounded-sm px-3 py-2 num"
                autoFocus
              />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setOutOfStockTarget(null);
                  setOutOfStockPin("");
                }}
                className="btn"
              >
                Cancel
              </button>
              <button onClick={submitOutOfStock} className="btn-danger">
                86 it
              </button>
            </div>
          </div>
        </div>
      )}

      {successOpen && (
        <div
          onClick={() => setSuccessOpen(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="panel-brass frame-deco w-full max-w-md text-center"
          >
            <div className="label">Paid · #{successOpen.orderNumber.toString().padStart(4, "0")}</div>
            <div className="mt-2 num text-3xl font-semibold text-bull">
              {formatAud(successOpen.total)}
            </div>
            {successOpen.change !== null && (
              <div className="mt-1 text-xs text-bull/80">
                Change due {formatAud(successOpen.change)}
              </div>
            )}
            <div className="mt-4 flex flex-col items-center gap-2">
              <QrImage
                value={
                  typeof window !== "undefined"
                    ? `${window.location.origin}/receipts/${successOpen.id}`
                    : `/receipts/${successOpen.id}`
                }
                size={180}
              />
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-dim">
                Customer scans for receipt
              </p>
            </div>
            <button onClick={() => setSuccessOpen(null)} className="btn-primary mt-4 w-full">
              Done
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function PickerModal({
  title,
  recentOrders,
  recentLoading,
  onPick,
  onClose,
  onRefresh,
}: {
  title: string;
  recentOrders: RecentOrder[];
  recentLoading: boolean;
  onPick: (o: RecentOrder) => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 p-4">
      <div className="panel w-full max-w-lg">
        <div className="flex items-center justify-between">
          <h3 className="label">{title}</h3>
          <button onClick={onRefresh} className="btn text-[10px]">refresh</button>
        </div>
        <div className="mt-3 max-h-80 overflow-y-auto">
          {recentLoading && <p className="num text-[11px] text-ink-dim">[ loading... ]</p>}
          {!recentLoading && recentOrders.length === 0 && (
            <p className="num text-[11px] text-ink-dim">[ no paid orders ]</p>
          )}
          <ul className="space-y-1">
            {recentOrders.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => onPick(o)}
                  className="w-full rounded-sm border border-edge p-2 text-left hover:border-bear hover:bg-bear/5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="num font-semibold">
                      #{o.orderNumber.toString().padStart(4, "0")}
                    </span>
                    <span className="num">{formatAud(o.total)}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-ink-dim">
                    {o.lines.map((l) => `${l.quantity}x ${l.drinkNameSnapshot}`).join(", ")}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={onClose} className="btn">Close</button>
        </div>
      </div>
    </div>
  );
}
