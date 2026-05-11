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
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi
          label="Index"
          value={`${state.marketIndexPct >= 0 ? "+" : ""}${state.marketIndexPct.toFixed(2)}%`}
          accent={state.marketIndexPct >= 0 ? "bull" : "bear"}
        />
        <Kpi
          label="Crash"
          value={state.crash.active ? `${state.crash.remainingSeconds}s` : "—"}
          accent={state.crash.active ? "bear" : "dim"}
        />
        <Kpi label="Dynamic drinks" value={`${dynamicDrinks.length}`} accent="ink" />
        <Kpi
          label="Trading"
          value={state.tradingOpen ? "OPEN" : "CLOSED"}
          accent={state.tradingOpen ? "bull" : "dim"}
        />
      </div>

      <section className="panel">
        <h2 className="label">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/crash" className="btn-danger">Trigger crash</Link>
          <Link href="/admin/menu" className="btn">Edit menu</Link>
          <Link href="/admin/market" className="btn">Market parameters</Link>
          <Link href="/admin/shifts" className="btn">Shifts</Link>
          <Link href="/dashboard" className="btn">Dashboard</Link>
        </div>
      </section>

      <section className="panel">
        <h2 className="label">Top movers</h2>
        <table className="mt-3 w-full text-xs">
          <thead className="text-left label">
            <tr className="border-b border-edge">
              <th className="py-2">Ticker</th>
              <th>Name</th>
              <th className="text-right">Now</th>
              <th className="text-right">Base</th>
              <th className="text-right">Change</th>
              <th className="text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {[...dynamicDrinks]
              .map((d) => ({ d, pct: ((d.currentPrice - d.basePrice) / d.basePrice) * 100 }))
              .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
              .slice(0, 8)
              .map(({ d, pct }) => (
                <tr key={d.id} className="border-b border-edge/50 last:border-0">
                  <td className="py-2">
                    <span className="ticker-symbol">{d.ticker}</span>
                  </td>
                  <td className="text-ink/90">{d.name}</td>
                  <td className="num text-right">{formatAud(d.currentPrice)}</td>
                  <td className="num text-right text-ink-dim">{formatAud(d.basePrice)}</td>
                  <td className={`num text-right ${pct >= 0 ? "text-bull" : "text-bear"}`}>
                    {pct >= 0 ? "+" : ""}
                    {(d.currentPrice - d.basePrice).toFixed(2)}
                  </td>
                  <td className={`num text-right ${pct >= 0 ? "text-bull" : "text-bear"}`}>
                    {pct >= 0 ? "+" : ""}
                    {pct.toFixed(2)}%
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent: "bull" | "bear" | "dim" | "ink" }) {
  const color =
    accent === "bull" ? "text-bull" : accent === "bear" ? "text-bear" : accent === "dim" ? "text-ink-dim" : "text-ink";
  return (
    <div className="panel">
      <div className="label">{label}</div>
      <div className={`mt-2 num text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
