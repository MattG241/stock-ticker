"use client";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { formatAdelaide } from "@/lib/time";
import type { SnapshotDrink } from "@/lib/snapshot";

interface Props {
  tradingOpen: boolean;
  marketIndexPct: number;
  drinks: SnapshotDrink[];
  connection: "connecting" | "live" | "offline";
}

export function DisplayHeader({ tradingOpen, marketIndexPct, drinks, connection }: Props) {
  const [clock, setClock] = useState(() => formatAdelaide(new Date()));
  useEffect(() => {
    const t = setInterval(() => setClock(formatAdelaide(new Date())), 1000);
    return () => clearInterval(t);
  }, []);

  let advances = 0;
  let declines = 0;
  let unchanged = 0;
  for (const d of drinks) {
    if (!d.isDynamic) continue;
    if (d.currentPrice > d.basePrice) advances++;
    else if (d.currentPrice < d.basePrice) declines++;
    else unchanged++;
  }

  const indexUp = marketIndexPct >= 0;

  return (
    <header className="border-b border-edge bg-bg-card/40">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Logo size={26} />
          <span className="text-[10px] uppercase tracking-[0.32em] text-ink-dim">
            Adelaide · AUD · TZ ACST/ACDT
          </span>
        </div>
        <div className="flex items-center gap-5">
          <Stat label="Market" value={tradingOpen ? "OPEN" : "CLOSED"} accent={tradingOpen ? "bull" : "dim"} />
          <Stat
            label="Index"
            value={`${indexUp ? "+" : ""}${marketIndexPct.toFixed(2)}%`}
            accent={indexUp ? "bull" : "bear"}
          />
          <Stat label="Adv" value={advances.toString()} accent="bull" />
          <Stat label="Dec" value={declines.toString()} accent="bear" />
          <Stat label="Unch" value={unchanged.toString()} accent="dim" />
          <Stat label="Clock" value={clock} accent="ink" mono />
          <ConnectionDot status={connection} />
        </div>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent: "bull" | "bear" | "dim" | "ink";
  mono?: boolean;
}) {
  const color =
    accent === "bull"
      ? "text-bull"
      : accent === "bear"
      ? "text-bear"
      : accent === "dim"
      ? "text-ink-dim"
      : "text-ink";
  return (
    <div className="flex flex-col items-end leading-none">
      <span className="label">{label}</span>
      <span className={`${mono === false ? "" : "num"} mt-0.5 text-[13px] font-semibold ${color}`}>
        {value}
      </span>
    </div>
  );
}

function ConnectionDot({ status }: { status: "connecting" | "live" | "offline" }) {
  const cls =
    status === "live"
      ? "bg-bull"
      : status === "connecting"
      ? "bg-amber animate-pulse"
      : "bg-bear animate-pulse";
  const label = status === "live" ? "LIVE" : status === "connecting" ? "SYNC" : "OFF";
  return (
    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-dim">
      <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />
      {label}
    </span>
  );
}
