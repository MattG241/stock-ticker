"use client";
import { useEffect, useState } from "react";
import { formatAud } from "@/lib/money";
import type { Drink } from "@/lib/types";

export default function MenuPage() {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/drinks", { cache: "no-store" });
    const data = await res.json();
    setDrinks(data.drinks ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const patch = async (id: string, body: Partial<Drink>) => {
    setBusyId(id);
    await fetch("/api/drinks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    await load();
    setBusyId(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl tracking-[0.28em]">MENU</h1>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-dim">
          Toggle active state · edit base price · override the live price (logged in audit)
        </p>
      </div>
      <table className="w-full text-xs">
        <thead className="text-left label">
          <tr className="border-b border-edge">
            <th className="py-2">Ticker</th>
            <th>Name</th>
            <th>Cat</th>
            <th className="text-right">Base</th>
            <th className="text-right">Now</th>
            <th className="text-right">Cost</th>
            <th className="text-center">Dyn</th>
            <th className="text-center">Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {drinks.map((d) => (
            <tr key={d.id} className="border-b border-edge/40 last:border-0">
              <td className="py-2">
                <span className="ticker-symbol">{d.ticker}</span>
              </td>
              <td className="text-ink/90">{d.name}</td>
              <td className="text-ink-dim">{d.category}</td>
              <td className="num text-right">{formatAud(d.basePrice)}</td>
              <td className="num text-right">{formatAud(d.currentPrice)}</td>
              <td className="num text-right text-ink-dim">{formatAud(d.costPrice)}</td>
              <td className="text-center">
                <button
                  className="btn px-2 py-0.5"
                  onClick={() => patch(d.id, { isDynamic: !d.isDynamic })}
                  disabled={busyId === d.id}
                >
                  {d.isDynamic ? "Yes" : "No"}
                </button>
              </td>
              <td className="text-center">
                <button
                  className="btn px-2 py-0.5"
                  onClick={() => patch(d.id, { isActive: !d.isActive })}
                  disabled={busyId === d.id}
                >
                  {d.isActive ? "On" : "Off"}
                </button>
              </td>
              <td className="text-right">
                <button
                  className="btn px-2 py-0.5"
                  disabled={busyId === d.id}
                  onClick={() => {
                    const v = prompt(`Override price for ${d.name}`, d.currentPrice.toFixed(2));
                    if (!v) return;
                    const num = parseFloat(v);
                    if (Number.isNaN(num) || num <= 0) return;
                    patch(d.id, { currentPrice: num });
                  }}
                >
                  Override
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
