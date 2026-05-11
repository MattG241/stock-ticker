"use client";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { formatAdelaide } from "@/lib/time";

export function DisplayHeader({
  tradingOpen,
  marketIndexPct,
  connection,
}: {
  tradingOpen: boolean;
  marketIndexPct: number;
  connection: "connecting" | "live" | "offline";
}) {
  const [clock, setClock] = useState(() => formatAdelaide(new Date()));
  useEffect(() => {
    const t = setInterval(() => setClock(formatAdelaide(new Date())), 1000);
    return () => clearInterval(t);
  }, []);
  const up = marketIndexPct >= 0;
  return (
    <header className="flex items-center justify-between px-6 py-4">
      <Logo size={28} />
      <div className="flex items-center gap-4">
        <span
          className={`pill ${
            tradingOpen ? "bg-bull/15 text-bull" : "bg-bg-elev text-ink-dim"
          }`}
        >
          ● {tradingOpen ? "MARKET OPEN" : "MARKET CLOSED"}
        </span>
        <span className={`num text-sm ${up ? "text-bull" : "text-bear"}`}>
          IDX {up ? "+" : ""}
          {marketIndexPct.toFixed(2)}%
        </span>
        <span className="num text-sm text-ink-dim">{clock}</span>
        <ConnectionDot status={connection} />
      </div>
    </header>
  );
}

function ConnectionDot({ status }: { status: "connecting" | "live" | "offline" }) {
  const cls =
    status === "live"
      ? "bg-bull"
      : status === "connecting"
      ? "bg-amber animate-pulse"
      : "bg-bear animate-pulse";
  const label =
    status === "live" ? "LIVE" : status === "connecting" ? "CONNECTING" : "OFFLINE";
  return (
    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-ink-dim">
      <span className={`h-2 w-2 rounded-full ${cls}`} />
      {label}
    </span>
  );
}
