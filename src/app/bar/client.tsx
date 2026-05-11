"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatAud } from "@/lib/money";
import { Logo } from "@/components/Logo";

interface OrderRow {
  id: string;
  orderNumber: number;
  total: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
  barAcked: boolean;
  lines: { drinkId: string; drinkNameSnapshot: string; quantity: number }[];
}

interface SnapshotDrinkLite {
  id: string;
  category: string;
}

const STATIONS: { key: string; label: string; categories: string[] | null }[] = [
  { key: "all", label: "All", categories: null },
  { key: "cocktails", label: "Cocktails", categories: ["Cocktails", "Shots"] },
  { key: "beer-wine", label: "Beer & Wine", categories: ["Beer", "Wine"] },
  { key: "spirits", label: "Spirits & N/A", categories: ["Spirits", "Non-Alc"] },
];

const CHIME_KEY = "drink-exchange-bar-chime";

export function BarClient() {
  const params = useSearchParams();
  const stationKey = params.get("station") ?? "all";
  const station = STATIONS.find((s) => s.key === stationKey) ?? STATIONS[0];

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [drinkCategories, setDrinkCategories] = useState<Record<string, string>>({});
  const [pendingAck, setPendingAck] = useState<Set<string>>(new Set());
  const [audioOn, setAudioOn] = useState(false);
  const inflightRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSeenOrderIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAudioOn(window.localStorage.getItem(CHIME_KEY) === "1");
  }, []);

  const enableAudio = () => {
    setAudioOn(true);
    try {
      window.localStorage.setItem(CHIME_KEY, "1");
      // Ensure the AudioContext is created from a user gesture.
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    } catch {
      // ignore
    }
  };

  const playChime = useCallback(() => {
    if (!audioOn) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // ignore
    }
  }, [audioOn]);

  const loadDrinks = useCallback(async () => {
    try {
      const res = await fetch("/api/state/snapshot", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, string> = {};
      for (const d of data.drinks ?? ([] as SnapshotDrinkLite[])) {
        map[d.id] = d.category;
      }
      setDrinkCategories(map);
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const list = (data.orders ?? []) as OrderRow[];
        if (initialLoadDone.current) {
          // Chime if any new "paid" order appeared.
          for (const o of list) {
            if (
              o.status === "paid" &&
              !o.barAcked &&
              !lastSeenOrderIds.current.has(o.id)
            ) {
              playChime();
            }
          }
        }
        lastSeenOrderIds.current = new Set(list.map((o) => o.id));
        initialLoadDone.current = true;
        setOrders(list);
      }
    } catch {
      // ignore
    }
  }, [playChime]);

  useEffect(() => {
    loadDrinks();
    load();
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/events");
      es.addEventListener("order.placed", load);
      es.addEventListener("order.updated", load);
      es.addEventListener("drink.updated", loadDrinks);
      es.addEventListener("drink.deleted", loadDrinks);
    } catch {
      // SSE may not be available - polling will cover us.
    }
    const t = setInterval(load, 5000);
    return () => {
      clearInterval(t);
      es?.close();
    };
  }, [load, loadDrinks]);

  const setAck = useCallback(async (id: string, acked: boolean) => {
    if (inflightRef.current.has(id)) return;
    inflightRef.current.add(id);
    setPendingAck((prev) => new Set(prev).add(id));
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, barAcked: acked } : o)));
    try {
      const res = await fetch(`/api/orders/${id}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acked, actor: "bar" }),
      });
      if (!res.ok) {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, barAcked: !acked } : o)));
      }
    } catch {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, barAcked: !acked } : o)));
    } finally {
      inflightRef.current.delete(id);
      setPendingAck((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  // Filter orders by station based on the drink categories present.
  const inStation = useCallback(
    (order: OrderRow): boolean => {
      if (!station.categories) return true;
      return order.lines.some((l) => {
        const cat = drinkCategories[l.drinkId];
        return cat ? station.categories!.includes(cat) : false;
      });
    },
    [station, drinkCategories],
  );

  const pending = useMemo(
    () =>
      orders
        .filter((o) => o.status === "paid" && !o.barAcked && inStation(o))
        .slice(0, 30),
    [orders, inStation],
  );
  const done = useMemo(
    () =>
      orders.filter((o) => o.status === "paid" && o.barAcked && inStation(o)).slice(0, 10),
    [orders, inStation],
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-edge bg-black/40 px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 py-3">
          <Logo size={20} />
          <div className="flex items-center gap-2">
            {STATIONS.map((s) => (
              <a
                key={s.key}
                href={`?station=${s.key}`}
                className={`btn px-2 py-1 text-[10px] ${s.key === station.key ? "border-bull text-bull" : ""}`}
              >
                {s.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="label">Bar queue</span>
            <span className="num text-2xl font-semibold text-bull">{pending.length}</span>
            <span className="label">pending</span>
            {!audioOn && (
              <button onClick={enableAudio} className="btn px-2 py-1 text-[10px]">
                Enable chime
              </button>
            )}
          </div>
        </div>
        <div className="brand-divider" />
      </header>
      <main className="mx-auto max-w-6xl space-y-5 p-6">
        <section>
          <h2 className="label mb-3">
            Pending {station.key !== "all" && `· ${station.label}`}
          </h2>
          {pending.length === 0 ? (
            <p className="num text-[11px] uppercase tracking-[0.18em] text-ink-dim">
              [ all caught up ]
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((o) => {
                const age = Math.round(
                  (Date.now() - new Date(o.paidAt ?? o.createdAt).getTime()) / 1000,
                );
                let tone = "border-bull/40 bg-bull/5";
                let ageColor = "text-bull";
                if (age > 90) {
                  tone = "border-bear/60 bg-bear/10";
                  ageColor = "text-bear";
                } else if (age > 30) {
                  tone = "border-amber/50 bg-amber/5";
                  ageColor = "text-amber";
                }
                const busy = pendingAck.has(o.id);
                return (
                  <li key={o.id} className={`panel flex flex-col gap-2 border ${tone}`}>
                    <div className="flex items-center justify-between">
                      <span className="num text-lg font-semibold">
                        #{o.orderNumber.toString().padStart(4, "0")}
                      </span>
                      <span className={`num text-xs ${ageColor}`}>
                        {age}s · {formatAud(o.total)}
                      </span>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {o.lines.map((l, i) => (
                        <li key={i} className="flex justify-between">
                          <span>
                            <span className="num font-semibold">{l.quantity}x</span>{" "}
                            {l.drinkNameSnapshot}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => setAck(o.id, true)}
                      disabled={busy}
                      className="btn-primary mt-auto disabled:opacity-50"
                    >
                      {busy ? "..." : "Mark made"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {done.length > 0 && (
          <section>
            <h2 className="label mb-3">Made · last {done.length}</h2>
            <ul className="space-y-1 text-xs">
              {done.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between border-b border-edge/40 py-1.5"
                >
                  <span>
                    <span className="num text-ink-dim">
                      #{o.orderNumber.toString().padStart(4, "0")}
                    </span>{" "}
                    <span className="ml-2 text-ink/80">
                      {o.lines.map((l) => `${l.quantity}x ${l.drinkNameSnapshot}`).join(", ")}
                    </span>
                  </span>
                  <button
                    onClick={() => setAck(o.id, false)}
                    disabled={pendingAck.has(o.id)}
                    className="btn text-[10px] disabled:opacity-50"
                  >
                    Re-open
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
