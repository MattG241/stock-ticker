"use client";
import { useEffect, useRef, useState } from "react";
import { formatAud, pctChange } from "@/lib/money";
import type { SnapshotDrink } from "@/lib/snapshot";
import { Sparkline } from "./Sparkline";

export function DrinkCard({
  drink,
  crash,
}: {
  drink: SnapshotDrink;
  crash: boolean;
}) {
  const pct = pctChange(drink.currentPrice, drink.basePrice);
  const up = pct >= 0;
  const showDiscount = crash && drink.isDynamic;
  const prev = useRef(drink.currentPrice);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (drink.currentPrice === prev.current) return;
    const direction = drink.currentPrice > prev.current ? "up" : "down";
    prev.current = drink.currentPrice;
    setFlash(direction);
    const t = setTimeout(() => setFlash(null), 600);
    return () => clearTimeout(t);
  }, [drink.currentPrice]);

  const change = drink.currentPrice - drink.basePrice;

  return (
    <div
      className={`panel-tight relative flex flex-col gap-1 overflow-hidden ${
        flash === "up" ? "animate-price-up" : flash === "down" ? "animate-price-down" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="ticker-symbol">{drink.ticker}</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-dim">
            {drink.category}
          </span>
        </div>
        <span className={`num text-[10px] font-medium ${up ? "text-bull" : "text-bear"}`}>
          {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
        </span>
      </div>

      <div className="mt-1 truncate text-[11px] tracking-wide text-ink/80">{drink.name}</div>

      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="leading-none">
          {showDiscount ? (
            <>
              <div className="num text-[10px] text-ink-ghost line-through">
                {formatAud(drink.currentPrice)}
              </div>
              <div className="num text-2xl font-semibold text-bear">
                {formatAud(drink.displayPrice)}
              </div>
            </>
          ) : (
            <div className="num text-2xl font-semibold">{formatAud(drink.displayPrice)}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <Sparkline points={drink.spark} basePrice={drink.basePrice} width={84} height={28} showRange={false} />
          <span className={`num text-[10px] ${up ? "text-bull" : "text-bear"}`}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
