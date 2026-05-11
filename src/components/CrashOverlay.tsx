"use client";
import { useEffect, useRef, useState } from "react";

const FLASH_MS = 3000;

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
        // audio gated until user interaction
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
          className="pointer-events-none fixed inset-0 z-50 bg-gradient-to-br from-bear via-bear/80 to-bear/50 animate-flash"
          style={{ opacity: 0.8 }}
        />
      )}
      {active && (
        <div className="sticky top-0 z-40 bg-bear text-bg px-4 py-2 flex items-center justify-between border-b-2 border-bear/70 shadow-lg">
          <div className="flex items-center gap-3 font-display text-2xl tracking-widest">
            <span aria-hidden>⚠</span>
            MARKET CRASH {Math.round(discountPercent * 100)}% OFF
          </div>
          <div className="num text-2xl font-bold">{remainingSeconds}s</div>
        </div>
      )}
    </>
  );
}
