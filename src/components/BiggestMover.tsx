"use client";
import { useEffect, useState } from "react";
import { formatAud } from "@/lib/money";

interface Mover {
  drinkId: string;
  ticker: string;
  name: string;
  fromPrice: number;
  toPrice: number;
  pctChange: number;
}

export function BiggestMoverCallout() {
  const [mover, setMover] = useState<Mover | null>(null);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch("/api/movers", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!stopped) setMover(data.biggestMover ?? null);
      } catch {
        // ignore
      }
    };
    load();
    const t = setInterval(load, 6000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, []);

  if (!mover || Math.abs(mover.pctChange) < 1) return null;
  const up = mover.pctChange >= 0;

  return (
    <div className="panel relative flex items-center gap-4 overflow-hidden border-bull/30 px-5 py-3">
      <div className="absolute inset-y-0 left-0 w-1 bg-bull" style={up ? {} : { background: "#FF4757" }} />
      <span className="label">5-min mover</span>
      <span className="ticker-symbol-lg">{mover.ticker}</span>
      <div className="leading-tight">
        <div className="text-sm font-semibold">{mover.name}</div>
        <div className="num text-[11px] text-ink-dim">
          {formatAud(mover.fromPrice)} → {formatAud(mover.toPrice)}
        </div>
      </div>
      <div className={`num ml-auto text-3xl font-semibold ${up ? "text-bull" : "text-bear"}`}>
        {up ? "+" : ""}
        {mover.pctChange.toFixed(2)}%
      </div>
    </div>
  );
}
