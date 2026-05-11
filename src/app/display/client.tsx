"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveState } from "@/lib/hooks/useLiveState";
import { DisplayHeader } from "@/components/DisplayHeader";
import { Ticker } from "@/components/Ticker";
import { DrinkCard } from "@/components/DrinkCard";
import { CrashOverlay } from "@/components/CrashOverlay";
import { formatAud, pctChange } from "@/lib/money";
import { Sparkline } from "@/components/Sparkline";

type Profile = "main" | "tape" | "featured";

export function DisplayClient() {
  const params = useSearchParams();
  const profile = (params.get("profile") as Profile | null) ?? "main";
  const { state } = useLiveState();
  const [audioArmed, setAudioArmed] = useState(false);

  if (!state) {
    return <div className="flex h-screen items-center justify-center text-ink-dim">Loading market...</div>;
  }

  const crashActive = state.crash.active;
  const discount = state.crash.event?.discountPercent ?? 0;
  const remaining = state.crash.remainingSeconds;

  return (
    <div className="min-h-screen">
      {!audioArmed && (
        <button
          onClick={() => setAudioArmed(true)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/80 text-2xl tracking-widest font-display"
        >
          TAP TO ENABLE SOUND
        </button>
      )}
      <CrashOverlay active={crashActive} discountPercent={discount} remainingSeconds={remaining} />
      <DisplayHeader
        tradingOpen={state.tradingOpen}
        marketIndexPct={state.marketIndexPct}
        connection={state.connectionStatus}
      />
      <Ticker drinks={state.drinks} crash={crashActive} />
      {profile === "tape" ? (
        <TapeOnly state={state} />
      ) : profile === "featured" ? (
        <Featured state={state} />
      ) : (
        <MainGrid state={state} crash={crashActive} />
      )}
    </div>
  );
}

function MainGrid({ state, crash }: { state: ReturnType<typeof useLiveState>["state"] & object; crash: boolean }) {
  if (!state) return null;
  return (
    <main className="px-6 py-6">
      {!state.tradingOpen && (
        <div className="mb-4 card border-amber text-amber">
          MARKET CLOSED. Last-known prices shown. Opens at {state.settings.tradingOpen}.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {state.drinks.map((d) => (
          <DrinkCard key={d.id} drink={d} crash={crash} />
        ))}
      </div>
    </main>
  );
}

function TapeOnly({ state }: { state: ReturnType<typeof useLiveState>["state"] }) {
  if (!state) return null;
  return (
    <main className="flex h-[calc(100vh-7rem)] items-center justify-center">
      <div className="w-full">
        <Ticker drinks={state.drinks} crash={state.crash.active} />
        <Ticker drinks={state.drinks} crash={state.crash.active} />
        <Ticker drinks={state.drinks} crash={state.crash.active} />
      </div>
    </main>
  );
}

function Featured({ state }: { state: ReturnType<typeof useLiveState>["state"] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => i + 1), 30000);
    return () => clearInterval(t);
  }, []);
  if (!state) return null;
  const all = state.drinks.filter((d) => d.isActive);
  if (!all.length) return null;
  const start = (idx * 3) % all.length;
  const selected = [0, 1, 2].map((k) => all[(start + k) % all.length]);
  const crash = state.crash.active;
  return (
    <main className="px-10 py-6 grid grid-cols-3 gap-6">
      {selected.map((d) => {
        const pct = pctChange(d.currentPrice, d.basePrice);
        const up = pct >= 0;
        return (
          <div key={d.id} className="card flex flex-col items-center justify-center gap-4 aspect-square">
            <div className="text-7xl">{d.emoji}</div>
            <div className="font-display text-3xl tracking-widest text-center">{d.name}</div>
            {crash && d.isDynamic ? (
              <>
                <div className="num text-2xl text-ink-dim line-through">{formatAud(d.currentPrice)}</div>
                <div className="num text-6xl font-bold text-bear">{formatAud(d.displayPrice)}</div>
              </>
            ) : (
              <div className="num text-6xl font-bold">{formatAud(d.displayPrice)}</div>
            )}
            <div className={`num text-lg ${up ? "text-bull" : "text-bear"}`}>
              {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
            </div>
            <Sparkline points={d.spark} basePrice={d.basePrice} width={240} height={48} />
          </div>
        );
      })}
    </main>
  );
}
