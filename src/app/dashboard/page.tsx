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
    .slice(0, 5);
  const aov = summary && summary.orders > 0 ? summary.revenue / summary.orders : 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-edge bg-black/40 px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between py-3">
          <Logo size={20} />
          <span className="pill border-brass/40 text-brass">Live Dashboard</span>
        </div>
        <div className="brand-divider" />
      </header>
      <main className="mx-auto max-w-6xl space-y-4 p-6">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label="Revenue today" value={formatAud(summary?.revenue ?? 0)} />
          <Kpi label="Drinks sold" value={`${summary?.drinksSold ?? 0}`} />
          <Kpi label="Avg order value" value={formatAud(aov)} />
          <Kpi
            label="Market index"
            value={`${state.marketIndexPct >= 0 ? "+" : ""}${state.marketIndexPct.toFixed(2)}%`}
            accent={state.marketIndexPct >= 0 ? "bull" : "bear"}
          />
        </div>

        <section className="grid gap-2 md:grid-cols-2">
          <div className="panel">
            <h2 className="label">Top movers</h2>
            <table className="mt-3 w-full text-xs">
              <thead className="label text-left">
                <tr className="border-b border-edge">
                  <th className="py-2">Sym</th>
                  <th>Name</th>
                  <th></th>
                  <th className="text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {movers.map(({ d, pct }) => (
                  <tr key={d.id} className="border-b border-edge/40 last:border-0">
                    <td className="py-2"><span className="ticker-symbol">{d.ticker}</span></td>
                    <td className="text-ink/90">{d.name}</td>
                    <td><Sparkline points={d.spark} basePrice={d.basePrice} width={100} height={22} showRange={false} /></td>
                    <td className={`num text-right ${pct >= 0 ? "text-bull" : "text-bear"}`}>
                      {pct >= 0 ? "+" : ""}
                      {pct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h2 className="label">Order feed</h2>
            <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {orders.slice(0, 20).map((o) => (
                <li key={o.id} className="flex items-center justify-between border-b border-edge/40 py-1.5 text-xs">
                  <span>
                    <span className="num text-ink-dim">#{o.orderNumber.toString().padStart(4, "0")}</span>{" "}
                    <span className="ml-2 text-ink/80">
                      {o.lines.map((l) => `${l.quantity}x ${l.drinkNameSnapshot}`).join(", ")}
                    </span>
                  </span>
                  <span className="num font-semibold">{formatAud(o.total)}</span>
                </li>
              ))}
              {orders.length === 0 && (
                <li className="num text-[11px] uppercase tracking-[0.18em] text-ink-dim">[ no orders yet ]</li>
              )}
            </ul>
          </div>
        </section>

        <section className="grid gap-2 md:grid-cols-2">
          <div className="panel">
            <h2 className="label">Revenue · per hour · today</h2>
            <div className="mt-3">
              <RevenueChart buckets={buckets} />
            </div>
          </div>
          <div className="panel">
            <h2 className="label">Margin alerts</h2>
            {alerts.length === 0 ? (
              <p className="mt-3 num text-[11px] uppercase tracking-[0.18em] text-ink-dim">[ no drinks at floor ]</p>
            ) : (
              <ul className="mt-3 space-y-1 text-xs">
                {alerts.map((a) => (
                  <li key={a.drinkId} className="flex items-center justify-between border-b border-edge/40 py-1">
                    <span>{a.drinkName}</span>
                    <span className="num text-amber">
                      floor {formatAud(a.floor)} · since {new Date(a.enteredAt).toLocaleTimeString("en-AU")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="panel">
          <h2 className="label">Shift summary</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            <li><div className="label">Shift</div><div className="num">{summary?.shiftId.slice(-6) ?? "—"}</div></li>
            <li><div className="label">Orders</div><div className="num">{summary?.orders ?? 0}</div></li>
            <li><div className="label">GST</div><div className="num">{formatAud(summary?.gst ?? 0)}</div></li>
            <li><div className="label">Crashes</div><div className="num">{summary?.crashes ?? 0}</div></li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "bull" | "bear" }) {
  const color = accent === "bull" ? "text-bull" : accent === "bear" ? "text-bear" : "text-ink";
  return (
    <div className="panel">
      <div className="label">{label}</div>
      <div className={`mt-2 num text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
