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
      className={`panel-tight relative flex flex-col gap-1.5 overflow-hidden ${
        flash === "up" ? "animate-price-up" : flash === "down" ? "animate-price-down" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate serif text-lg font-semibold leading-tight tracking-tight">{drink.name}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="ticker-symbol">{drink.ticker}</span>
            <span className="label-dim">{drink.category}</span>
          </div>
        </div>
        <span className={`num text-[10px] font-medium leading-none ${up ? "text-bull" : "text-bear"}`}>
          {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
        </span>
      </div>

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
            <div className="num text-2xl font-semibold text-ink">{formatAud(drink.displayPrice)}</div>
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
