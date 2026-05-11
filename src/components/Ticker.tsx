"use client";
import { formatAud } from "@/lib/money";
import type { SnapshotDrink } from "@/lib/snapshot";

export function Ticker({
  drinks,
  crash,
}: {
  drinks: SnapshotDrink[];
  crash: boolean;
}) {
  const items = drinks.filter((d) => d.isActive);
  const row = items.map((d) => {
    const pct = ((d.currentPrice - d.basePrice) / d.basePrice) * 100;
    const up = pct >= 0;
    return (
      <span key={d.id} className="inline-flex items-center gap-2 px-5">
        <span className="num text-[11px] font-semibold tracking-[0.06em] text-ink">{d.ticker}</span>
        <span className={`num text-[12px] ${crash ? "text-bear" : "text-ink"}`}>
          {formatAud(d.displayPrice)}
        </span>
        <span className={`num text-[11px] ${up ? "text-bull" : "text-bear"}`}>
          {up ? "▲" : "▼"}
          {Math.abs(pct).toFixed(2)}%
        </span>
        <span className="text-ink-ghost">·</span>
      </span>
    );
  });
  return (
    <div
      className={`scroll-tape overflow-hidden whitespace-nowrap border-y border-edge bg-bg-card/60 py-1.5 ${
        crash ? "text-bear" : ""
      }`}
    >
      <div className="inline-block animate-marquee">
        {row}
        {row}
      </div>
    </div>
  );
}
