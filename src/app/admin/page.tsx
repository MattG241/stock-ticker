"use client";
import { useLiveState } from "@/lib/hooks/useLiveState";
import { formatAud } from "@/lib/money";
import Link from "next/link";

export default function AdminOverview() {
  const { state } = useLiveState();
  if (!state) return <div className="text-ink-dim">Loading...</div>;
  const dynamicDrinks = state.drinks.filter((d) => d.isDynamic);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Market index" value={`${state.marketIndexPct >= 0 ? "+" : ""}${state.marketIndexPct.toFixed(2)}%`} accent={state.marketIndexPct >= 0 ? "bull" : "bear"} />
        <Kpi label="Crash active" value={state.crash.active ? `${state.crash.remainingSeconds}s` : "No"} accent={state.crash.active ? "bear" : "dim"} />
        <Kpi label="Dynamic drinks" value={`${dynamicDrinks.length}`} accent="dim" />
        <Kpi label="Trading" value={state.tradingOpen ? "OPEN" : "CLOSED"} accent={state.tradingOpen ? "bull" : "dim"} />
      </div>

      <section className="card">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/crash" className="btn-danger">Trigger crash</Link>
          <Link href="/admin/menu" className="btn">Edit menu</Link>
          <Link href="/admin/market" className="btn">Market parameters</Link>
          <Link href="/dashboard" className="btn">Open dashboard</Link>
        </div>
      </section>

      <section className="card">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">Top movers</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {[...dynamicDrinks]
            .map((d) => ({ d, pct: ((d.currentPrice - d.basePrice) / d.basePrice) * 100 }))
            .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
            .slice(0, 6)
            .map(({ d, pct }) => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <span>
                  {d.emoji} {d.name}
                </span>
                <span className={`num ${pct >= 0 ? "text-bull" : "text-bear"}`}>
                  {pct >= 0 ? "+" : ""}
                  {pct.toFixed(2)}% · {formatAud(d.currentPrice)}
                </span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent: "bull" | "bear" | "dim" }) {
  const color = accent === "bull" ? "text-bull" : accent === "bear" ? "text-bear" : "text-ink";
  return (
    <div className="card">
      <div className="text-[10px] uppercase tracking-widest text-ink-dim">{label}</div>
      <div className={`mt-2 num text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
