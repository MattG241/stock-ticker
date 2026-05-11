"use client";
import { useEffect, useRef, useState } from "react";

const FLASH_MS = 2500;

export function CrashOverlay({
  active,
  discountPercent,
  remainingSeconds,
  triggeredVia,
}: {
  active: boolean;
  discountPercent: number;
  remainingSeconds: number;
  triggeredVia?: string;
}) {
  const [flash, setFlash] = useState(false);
  const lastActive = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Local 1s decrement between server `crash.tick` events so the visible
  // timer keeps moving smoothly even if SSE briefly stalls.
  const [localRemaining, setLocalRemaining] = useState(remainingSeconds);

  useEffect(() => {
    setLocalRemaining(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setLocalRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    if (active && !lastActive.current) {
      setFlash(true);
      try {
        audioRef.current?.play().catch(() => {});
      } catch {
        // audio gated
      }
      const t = setTimeout(() => setFlash(false), FLASH_MS);
      lastActive.current = true;
      return () => clearTimeout(t);
    }
    if (!active) {
      lastActive.current = false;
      setFlash(false);
    }
  }, [active]);

  const isLastCall = triggeredVia === "closing-bell";
  const palette = isLastCall
    ? {
        flashColor: "rgba(197,163,82,0.45)",
        flashOuter: "rgba(197,163,82,0.15)",
        accent: "border-brass/60 bg-brass/15 text-brass",
        ribbon: "border-brass/40 bg-brass/15",
        chip: "border-brass/60 bg-brass/25 text-brass",
        text: "text-brass",
        textDim: "text-brass/70",
        headline: "LAST CALL · CLOSING BELL",
      }
    : {
        flashColor: "rgba(192,50,47,0.45)",
        flashOuter: "rgba(192,50,47,0.15)",
        accent: "border-bear/60 bg-bear/15 text-bear",
        ribbon: "border-bear/40 bg-bear/15",
        chip: "border-bear/60 bg-bear/25 text-bear",
        text: "text-bear",
        textDim: "text-bear/70",
        headline: "MARKET-WIDE CRASH",
      };

  const mm = Math.floor(localRemaining / 60).toString().padStart(2, "0");
  const ss = (localRemaining % 60).toString().padStart(2, "0");

  return (
    <>
      <audio ref={audioRef} src="/crash.mp3" preload="auto" />
      {flash && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            background: `radial-gradient(circle at center, ${palette.flashColor} 0%, ${palette.flashOuter} 40%, transparent 75%)`,
            animation: "flash 200ms ease-out",
            opacity: 0.95,
          }}
        />
      )}
      {active && (
        <div className={`sticky top-0 z-40 flex items-center justify-between border-b ${palette.ribbon} px-6 py-3 backdrop-blur`}>
          <div className="flex items-center gap-4">
            <span
              className={`num rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.32em] ${palette.chip}`}
            >
              {isLastCall ? "Bell" : "Halt"}
            </span>
            <div className="leading-tight">
              <div className={`serif text-base tracking-[0.24em] ${palette.text}`}>
                {palette.headline}
              </div>
              <div className={`num text-[11px] uppercase tracking-[0.18em] ${palette.textDim}`}>
                {Math.round(discountPercent * 100)}% OFF ALL DYNAMIC DRINKS · MARGIN FLOOR ENFORCED
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <span className={`label-dim ${palette.textDim}`}>Remaining</span>
            <span className={`num text-3xl font-semibold ${palette.text}`}>
              {mm}:{ss}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
