"use client";
import { useEffect, useState } from "react";
import { useLiveState } from "@/lib/hooks/useLiveState";
import { formatAud, pctChange } from "@/lib/money";
import { Sparkline } from "@/components/Sparkline";
import { Logo } from "@/components/Logo";
import { RevenueChart } from "@/components/RevenueChart";
import type { MarginAlert } from "@/lib/types";

interface ShiftSummary {
  shiftId: string;
  orders: number;
  revenue: number;
  gst: number;
  drinksSold: number;
  crashes: number;
}

interface OrderRow {
  id: string;
  orderNumber: number;
  total: number;
  paymentMethod: string;
  paidAt: string | null;
  lines: { drinkNameSnapshot: string; quantity: number }[];
}

export default function DashboardPage() {
  const { state } = useLiveState();
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [buckets, setBuckets] = useState<{ hour: string; revenue: number; orders: number }[]>([]);
  const [alerts, setAlerts] = useState<MarginAlert[]>([]);

  useEffect(() => {
    const load = async () => {
      const [s, o, r, a] = await Promise.all([
        fetch("/api/shift", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/orders", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/dashboard/revenue-per-hour", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/alerts", { cache: "no-store" }).then((x) => x.json()),
      ]);
      setSummary(s);
      setOrders(o.orders ?? []);
      setBuckets(r.buckets ?? []);
      setAlerts(a.alerts ?? []);
    };
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  if (!state) return <div className="p-10 text-ink-dim">Loading...</div>;

  const dyn = state.drinks.filter((d) => d.isDynamic);
  const movers = [...dyn]
    .map((d) => ({ d, pct: pctChange(d.currentPrice, d.basePrice) }))
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, 4);
  const aov = summary && summary.orders > 0 ? summary.revenue / summary.orders : 0;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-edge px-6 py-3">
        <Logo size={22} />
        <span className="pill bg-bg-elev text-ink-dim">LIVE DASHBOARD</span>
      </header>
      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="Revenue today" value={formatAud(summary?.revenue ?? 0)} />
          <Kpi label="Drinks sold" value={`${summary?.drinksSold ?? 0}`} />
          <Kpi label="Avg order value" value={formatAud(aov)} />
          <Kpi
            label="Market index"
            value={`${state.marketIndexPct >= 0 ? "+" : ""}${state.marketIndexPct.toFixed(2)}%`}
            accent={state.marketIndexPct >= 0 ? "bull" : "bear"}
          />
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">Top movers</h2>
            <div className="mt-3 space-y-3">
              {movers.map(({ d, pct }) => (
                <div key={d.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span>{d.emoji}</span>
                    <span className="text-sm">{d.name}</span>
                  </div>
                  <Sparkline points={d.spark} basePrice={d.basePrice} width={120} height={28} />
                  <span className={`num text-sm ${pct >= 0 ? "text-bull" : "text-bear"}`}>
                    {pct >= 0 ? "+" : ""}
                    {pct.toFixed(2)}%
                  </span>
                </div>
              ))}
              {movers.length === 0 && <p className="text-sm text-ink-dim">No dynamic drinks active.</p>}
            </div>
          </div>
          <div className="card">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">Live order feed</h2>
            <ul className="mt-3 space-y-1.5 max-h-72 overflow-y-auto">
              {orders.slice(0, 20).map((o) => (
                <li key={o.id} className="flex items-center justify-between border-b border-edge/50 py-1.5 text-sm">
                  <span>
                    <span className="num text-ink-dim">#{o.orderNumber}</span>{" "}
                    <span className="ml-1 text-xs text-ink-dim">
                      {o.lines.map((l) => `${l.quantity}x ${l.drinkNameSnapshot}`).join(", ")}
                    </span>
                  </span>
                  <span className="num">{formatAud(o.total)}</span>
                </li>
              ))}
              {orders.length === 0 && <li className="text-sm text-ink-dim">No orders yet.</li>}
            </ul>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">Revenue per hour (today)</h2>
            <div className="mt-3">
              <RevenueChart buckets={buckets} />
            </div>
          </div>
          <div className="card">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">Margin alerts</h2>
            {alerts.length === 0 ? (
              <p className="mt-3 text-sm text-ink-dim">No drinks at margin floor.</p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {alerts.map((a) => (
                  <li key={a.drinkId} className="flex items-center justify-between border-b border-edge/50 pb-1">
                    <span>{a.drinkName}</span>
                    <span className="num text-amber">
                      floor {formatAud(a.floor)} - since {new Date(a.enteredAt).toLocaleTimeString("en-AU")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">Shift summary</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <li>
              <div className="text-ink-dim text-xs">Shift</div>
              <div className="num">{summary?.shiftId.slice(-6) ?? "—"}</div>
            </li>
            <li>
              <div className="text-ink-dim text-xs">Orders</div>
              <div className="num">{summary?.orders ?? 0}</div>
            </li>
            <li>
              <div className="text-ink-dim text-xs">GST</div>
              <div className="num">{formatAud(summary?.gst ?? 0)}</div>
            </li>
            <li>
              <div className="text-ink-dim text-xs">Crashes</div>
              <div className="num">{summary?.crashes ?? 0}</div>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "bull" | "bear";
}) {
  const color = accent === "bull" ? "text-bull" : accent === "bear" ? "text-bear" : "text-ink";
  return (
    <div className="card">
      <div className="text-[10px] uppercase tracking-widest text-ink-dim">{label}</div>
      <div className={`mt-2 num text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
