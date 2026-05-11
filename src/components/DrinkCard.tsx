"use client";
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
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none">{drink.emoji}</span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{drink.name}</div>
            <div className="text-[10px] uppercase tracking-widest text-ink-dim">
              {drink.category}
            </div>
          </div>
        </div>
        <span
          className={`pill ${
            up ? "bg-bull/10 text-bull" : "bg-bear/10 text-bear"
          }`}
        >
          {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
        </span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          {showDiscount ? (
            <>
              <div className="num text-xs text-ink-dim line-through">
                {formatAud(drink.currentPrice)}
              </div>
              <div className="num text-3xl font-bold text-bear">
                {formatAud(drink.displayPrice)}
              </div>
            </>
          ) : (
            <div className="num text-3xl font-bold">{formatAud(drink.displayPrice)}</div>
          )}
        </div>
        <Sparkline points={drink.spark} basePrice={drink.basePrice} width={96} height={36} />
      </div>
    </div>
  );
}
