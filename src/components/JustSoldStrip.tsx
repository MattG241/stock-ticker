"use client";
import { useEffect, useState } from "react";
import { formatAud } from "@/lib/money";

interface Sale {
  id: string;
  ticker: string;
  name: string;
  quantity: number;
  total: number;
  ts: number;
}

export function JustSoldStrip() {
  const [sales, setSales] = useState<Sale[]>([]);
  // Tick once per second so the "Ns ago" labels stay current without refetch.
  const [, setNowTick] = useState(0);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch("/api/movers", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!stopped) setSales(data.recentSales ?? []);
      } catch {
        // ignore
      }
    };
    load();
    const poll = setInterval(load, 4000);
    const clock = setInterval(() => setNowTick((x) => x + 1), 1000);
    return () => {
      stopped = true;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  const row = sales.map((s) => {
    const ago = Math.max(1, Math.round((Date.now() - s.ts) / 1000));
    return (
      <span key={s.id} className="inline-flex items-center gap-1.5 whitespace-nowrap px-4 text-[11px]">
        <span className="num text-ink-dim">{ago}s</span>
        <span className="num font-semibold text-bull">{s.quantity}x</span>
        <span className="num text-ink">{s.ticker}</span>
        <span className="num text-ink-ghost">·</span>
        <span className="num text-ink/80">{formatAud(s.total)}</span>
        <span className="text-ink-ghost">·</span>
      </span>
    );
  });

  return (
    <div className="flex items-center border-b border-edge bg-black/40">
      <div className="shrink-0 border-r border-edge px-4 py-1.5">
        <span className="label">Recent prints</span>
      </div>
      <div className="scroll-tape relative flex-1 overflow-hidden py-1.5">
        {sales.length === 0 ? (
          <span className="num pl-4 text-[11px] uppercase tracking-[0.22em] text-ink-ghost">
            [ awaiting orders ]
          </span>
        ) : (
          <div className="inline-block whitespace-nowrap animate-marquee">
            {row}
            {row}
          </div>
        )}
      </div>
    </div>
  );
}
