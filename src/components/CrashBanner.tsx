"use client";
import { useEffect, useState } from "react";

export function CrashBanner({
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

  if (!active) return null;

  const isLastCall = triggeredVia === "closing-bell";
  const palette = isLastCall
    ? {
        wrap: "border-brass/60 bg-brass/15",
        text: "text-brass",
        textDim: "text-brass/70",
        chip: "border-brass/60 bg-brass/30 text-brass",
        headline: "LAST CALL",
      }
    : {
        wrap: "border-bear/60 bg-bear/15",
        text: "text-bear",
        textDim: "text-bear/70",
        chip: "border-bear/60 bg-bear/30 text-bear",
        headline: "MARKET CRASH",
      };

  const mm = Math.floor(localRemaining / 60).toString().padStart(2, "0");
  const ss = (localRemaining % 60).toString().padStart(2, "0");

  return (
    <div className={`flex items-center justify-between gap-3 rounded-sm border ${palette.wrap} px-3 py-2`}>
      <div className="flex items-center gap-2">
        <span
          className={`num rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] ${palette.chip}`}
        >
          {isLastCall ? "Bell" : "Halt"}
        </span>
        <div className="leading-tight">
          <div className={`serif text-sm font-semibold tracking-[0.18em] ${palette.text}`}>
            {palette.headline} · −{Math.round(discountPercent * 100)}%
          </div>
          <div className={`num text-[10px] uppercase tracking-[0.18em] ${palette.textDim}`}>
            upsell now — push refusals at the floor
          </div>
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`label-dim ${palette.textDim}`}>ends</span>
        <span className={`num text-xl font-semibold ${palette.text}`}>
          {mm}:{ss}
        </span>
      </div>
    </div>
  );
}
