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
    const t = setInterval(load, 4000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, []);

  if (sales.length === 0) {
    return (
      <div className="flex items-center gap-3 border-b border-edge bg-bg-card/40 px-6 py-1.5">
        <span className="label text-ink-dim">Recent prints</span>
        <span className="num text-[11px] uppercase tracking-[0.18em] text-ink-ghost">[ awaiting orders ]</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 overflow-x-auto border-b border-edge bg-bg-card/40 px-6 py-1.5">
      <span className="label shrink-0 text-ink-dim">Recent prints</span>
      <div className="flex gap-3">
        {sales.map((s) => {
          const ago = Math.max(1, Math.round((Date.now() - s.ts) / 1000));
          return (
            <span key={s.id} className="flex items-center gap-1.5 whitespace-nowrap text-[11px]">
              <span className="num text-ink-dim">{ago}s</span>
              <span className="num font-semibold text-bull">{s.quantity}x</span>
              <span className="num text-ink">{s.ticker}</span>
              <span className="num text-ink-dim">·</span>
              <span className="num text-ink/80">{formatAud(s.total)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
