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
      <h1 className="font-display text-3xl tracking-widest">MENU</h1>
      <p className="text-sm text-ink-dim">
        Toggle active state, edit base price, or override the live price (logged in audit).
      </p>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-ink-dim">
          <tr>
            <th className="py-2">Drink</th>
            <th>Cat</th>
            <th>Base</th>
            <th>Now</th>
            <th>Cost</th>
            <th>Dynamic</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {drinks.map((d) => (
            <tr key={d.id} className="border-t border-edge align-middle">
              <td className="py-2">
                {d.emoji} <span className="ml-1">{d.name}</span>
              </td>
              <td className="text-ink-dim">{d.category}</td>
              <td className="num">{formatAud(d.basePrice)}</td>
              <td className="num">{formatAud(d.currentPrice)}</td>
              <td className="num text-ink-dim">{formatAud(d.costPrice)}</td>
              <td>
                <button
                  className="btn px-2 py-0.5 text-xs"
                  onClick={() => patch(d.id, { isDynamic: !d.isDynamic })}
                  disabled={busyId === d.id}
                >
                  {d.isDynamic ? "Yes" : "No"}
                </button>
              </td>
              <td>
                <button
                  className="btn px-2 py-0.5 text-xs"
                  onClick={() => patch(d.id, { isActive: !d.isActive })}
                  disabled={busyId === d.id}
                >
                  {d.isActive ? "On" : "Off"}
                </button>
              </td>
              <td className="text-right">
                <button
                  className="btn px-2 py-0.5 text-xs"
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
