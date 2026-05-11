"use client";
import { useEffect, useState } from "react";
import { formatAud } from "@/lib/money";
import { Logo } from "@/components/Logo";

interface OrderRow {
  id: string;
  orderNumber: number;
  total: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
  lines: { drinkId: string; drinkNameSnapshot: string; quantity: number }[];
}

const ACK_KEY = "drink-exchange-bar-ack";

export function BarClient() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ack, setAck] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(ACK_KEY);
        if (raw) setAck(new Set(JSON.parse(raw)));
      } catch {}
    }
    const load = async () => {
      const res = await fetch("/api/orders", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
      }
    };
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const toggleAck = (id: string) => {
    setAck((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(ACK_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const pending = orders.filter((o) => o.status === "paid" && !ack.has(o.id)).slice(0, 30);
  const done = orders.filter((o) => o.status === "paid" && ack.has(o.id)).slice(0, 10);

  return (
    <div className="min-h-screen">
      <header className="border-b border-edge bg-black/40 px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between py-3">
          <Logo size={20} />
          <div className="flex items-center gap-3">
            <span className="label">Bar queue</span>
            <span className="num text-2xl font-semibold text-bull">{pending.length}</span>
            <span className="label">pending</span>
          </div>
        </div>
        <div className="brand-divider" />
      </header>
      <main className="mx-auto max-w-6xl space-y-5 p-6">
        <section>
          <h2 className="label mb-3">Pending</h2>
          {pending.length === 0 ? (
            <p className="num text-[11px] uppercase tracking-[0.18em] text-ink-dim">[ all caught up ]</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((o) => {
                const age = Math.round((Date.now() - new Date(o.paidAt ?? o.createdAt).getTime()) / 1000);
                const stale = age > 90;
                return (
                  <li
                    key={o.id}
                    className={`panel flex flex-col gap-2 ${stale ? "border-bear/40" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="num text-lg font-semibold">
                        #{o.orderNumber.toString().padStart(4, "0")}
                      </span>
                      <span className={`num text-xs ${stale ? "text-bear" : "text-ink-dim"}`}>
                        {age}s · {formatAud(o.total)}
                      </span>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {o.lines.map((l, i) => (
                        <li key={i} className="flex justify-between">
                          <span>
                            <span className="num font-semibold">{l.quantity}x</span> {l.drinkNameSnapshot}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => toggleAck(o.id)} className="btn-primary mt-auto">
                      Mark made
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
                <li key={o.id} className="flex items-center justify-between border-b border-edge/40 py-1.5">
                  <span>
                    <span className="num text-ink-dim">#{o.orderNumber.toString().padStart(4, "0")}</span>{" "}
                    <span className="ml-2 text-ink/80">
                      {o.lines.map((l) => `${l.quantity}x ${l.drinkNameSnapshot}`).join(", ")}
                    </span>
                  </span>
                  <button onClick={() => toggleAck(o.id)} className="btn text-[10px]">
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
