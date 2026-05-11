"use client";
import { useEffect, useRef, useState } from "react";

const FLASH_MS = 2500;

export function CrashOverlay({
  active,
  discountPercent,
  remainingSeconds,
}: {
  active: boolean;
  discountPercent: number;
  remainingSeconds: number;
}) {
  const [flash, setFlash] = useState(false);
  const lastActive = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  return (
    <>
      <audio ref={audioRef} src="/crash.mp3" preload="auto" />
      {flash && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            background:
              "radial-gradient(circle at center, rgba(192,50,47,0.45) 0%, rgba(192,50,47,0.15) 40%, transparent 75%)",
            animation: "flash 200ms ease-out",
            opacity: 0.9,
          }}
        />
      )}
      {active && (
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-bear/40 bg-bear/15 px-6 py-2 backdrop-blur">
          <div className="flex items-center gap-4">
            <span className="num rounded-sm border border-bear/60 bg-bear/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.32em] text-bear">
              Halt
            </span>
            <span className="serif text-sm tracking-[0.24em] text-bear/95">
              MARKET-WIDE CRASH · {Math.round(discountPercent * 100)}% OFF ALL DYNAMIC DRINKS
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="label-dim text-bear/70">Remaining</span>
            <span className="num text-xl font-semibold text-bear">
              {remainingSeconds.toString().padStart(2, "0")}s
            </span>
          </div>
        </div>
      )}
    </>
  );
}
