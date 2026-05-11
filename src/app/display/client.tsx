"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveState } from "@/lib/hooks/useLiveState";
import { DisplayHeader } from "@/components/DisplayHeader";
import { Ticker } from "@/components/Ticker";
import { DrinkCard } from "@/components/DrinkCard";
import { CrashOverlay } from "@/components/CrashOverlay";
import { JustSoldStrip } from "@/components/JustSoldStrip";
import { BiggestMoverCallout } from "@/components/BiggestMover";
import { formatAud, pctChange } from "@/lib/money";
import { Sparkline } from "@/components/Sparkline";

type Profile = "main" | "tape" | "featured";

const AUDIO_KEY = "drink-exchange-audio-armed";

export function DisplayClient() {
  const params = useSearchParams();
  const profile = (params.get("profile") as Profile | null) ?? "main";
  const audioParam = params.get("audio");
  const { state } = useLiveState();
  const [audioArmed, setAudioArmed] = useState(false);

  useEffect(() => {
    if (audioParam === "skip") {
      setAudioArmed(true);
      return;
    }
    if (typeof window !== "undefined" && window.localStorage.getItem(AUDIO_KEY) === "1") {
      setAudioArmed(true);
    }
  }, [audioParam]);

  const armAudio = () => {
    setAudioArmed(true);
    try {
      window.localStorage.setItem(AUDIO_KEY, "1");
    } catch {}
  };

  if (!state) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg text-ink-dim">
        <span className="num text-xs uppercase tracking-[0.32em]">Connecting to market...</span>
      </div>
    );
  }

  const crashActive = state.crash.active;
  const discount = state.crash.event?.discountPercent ?? 0;
  const remaining = state.crash.remainingSeconds;

  return (
    <div className="display-scanlines min-h-screen bg-bg">
      {!audioArmed && (
        <button
          onClick={armAudio}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-bg/95 text-xs uppercase tracking-[0.32em] text-brass-dim hover:text-brass"
        >
          <span className="serif text-2xl tracking-[0.18em] text-ink">Raise a glass</span>
          <span>[ tap to enable audio · or load ?audio=skip ]</span>
        </button>
      )}
      <CrashOverlay active={crashActive} discountPercent={discount} remainingSeconds={remaining} />
      <DisplayHeader
        tradingOpen={state.tradingOpen}
        marketIndexPct={state.marketIndexPct}
        drinks={state.drinks}
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

function MainGrid({
  state,
  crash,
}: {
  state: NonNullable<ReturnType<typeof useLiveState>["state"]>;
  crash: boolean;
}) {
  return (
    <>
      <JustSoldStrip />
      <main className="px-6 py-3 space-y-3">
        <BiggestMoverCallout />
        {!state.tradingOpen && (
          <div className="panel border-amber/40 text-amber">
            <span className="label text-amber">Market closed</span>
            <p className="mt-1 text-sm">Last-known prices shown. Opens at {state.settings.tradingOpen}.</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {state.drinks.map((d) => (
            <DrinkCard key={d.id} drink={d} crash={crash} />
          ))}
        </div>
      </main>
    </>
  );
}

function TapeOnly({ state }: { state: NonNullable<ReturnType<typeof useLiveState>["state"]> }) {
  return (
    <main className="flex h-[calc(100vh-4.5rem)] flex-col justify-evenly bg-bg">
      <Ticker drinks={state.drinks} crash={state.crash.active} />
      <Ticker drinks={state.drinks} crash={state.crash.active} />
      <Ticker drinks={state.drinks} crash={state.crash.active} />
      <Ticker drinks={state.drinks} crash={state.crash.active} />
      <Ticker drinks={state.drinks} crash={state.crash.active} />
    </main>
  );
}

function Featured({ state }: { state: NonNullable<ReturnType<typeof useLiveState>["state"]> }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => i + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const all = state.drinks.filter((d) => d.isActive);
  if (!all.length) return null;
  const start = (idx * 3) % all.length;
  const selected = [0, 1, 2].map((k) => all[(start + k) % all.length]);
  const crash = state.crash.active;
  return (
    <main className="grid grid-cols-3 gap-3 px-6 py-5">
      {selected.map((d) => {
        const pct = pctChange(d.currentPrice, d.basePrice);
        const up = pct >= 0;
        const change = d.currentPrice - d.basePrice;
        return (
          <div key={d.id} className="panel-brass frame-deco relative flex aspect-square flex-col justify-between">
            <div>
              <div className="serif text-2xl font-semibold leading-tight tracking-tight text-ink">{d.name}</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="ticker-symbol-lg">{d.ticker}</span>
                <span className="label">{d.category}</span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-1">
              {crash && d.isDynamic ? (
                <>
                  <span className="num text-base text-ink-ghost line-through">{formatAud(d.currentPrice)}</span>
                  <span className="num text-6xl font-semibold text-bear">{formatAud(d.displayPrice)}</span>
                </>
              ) : (
                <span className="num text-6xl font-semibold text-ink">{formatAud(d.displayPrice)}</span>
              )}
              <div className={`num text-sm ${up ? "text-bull" : "text-bear"}`}>
                {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}% · {change >= 0 ? "+" : ""}
                {change.toFixed(2)}
              </div>
            </div>
            <Sparkline points={d.spark} basePrice={d.basePrice} width={300} height={56} />
          </div>
        );
      })}
    </main>
  );
}
