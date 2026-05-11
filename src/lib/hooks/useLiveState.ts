"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Snapshot } from "@/lib/snapshot";
import type { CrashEvent, PricePoint } from "@/lib/types";

const HISTORY_LIMIT = 25;

export interface LiveState extends Snapshot {
  connectionStatus: "connecting" | "live" | "offline";
}

export function useLiveState() {
  const [state, setState] = useState<LiveState | null>(null);
  const stateRef = useRef<LiveState | null>(null);
  stateRef.current = state;

  const snapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/state/snapshot", { cache: "no-store" });
      if (!res.ok) throw new Error("snapshot failed");
      const snap = (await res.json()) as Snapshot;
      setState({ ...snap, connectionStatus: "connecting" });
    } catch {
      setState((prev) => (prev ? { ...prev, connectionStatus: "offline" } : prev));
    }
  }, []);

  useEffect(() => {
    snapshot();
  }, [snapshot]);

  useEffect(() => {
    let es: EventSource | null = null;
    let offlineTimer: ReturnType<typeof setTimeout> | null = null;
    let lastBeat = Date.now();
    const beatTimer = setInterval(() => {
      if (Date.now() - lastBeat > 30000) {
        snapshot();
        lastBeat = Date.now();
      }
    }, 5000);

    const connect = () => {
      es = new EventSource("/api/events");
      es.onopen = () => {
        lastBeat = Date.now();
        setState((prev) => (prev ? { ...prev, connectionStatus: "live" } : prev));
      };
      es.onerror = () => {
        if (offlineTimer) return;
        offlineTimer = setTimeout(() => {
          setState((prev) => (prev ? { ...prev, connectionStatus: "offline" } : prev));
          offlineTimer = null;
        }, 1500);
      };
      const onTick = (e: MessageEvent) => {
        lastBeat = Date.now();
        const updates = JSON.parse(e.data) as { drinkId: string; currentPrice: number; ts: number }[];
        setState((prev) => {
          if (!prev) return prev;
          const byId = new Map(prev.drinks.map((d) => [d.id, d]));
          const discount = prev.crash.active ? prev.crash.event?.discountPercent ?? 0 : 0;
          for (const u of updates) {
            const d = byId.get(u.drinkId);
            if (!d) continue;
            const display = d.isDynamic
              ? Math.max(
                  u.currentPrice * (1 - discount),
                  d.costPrice * (1 + prev.settings.minMarginMultiplier),
                )
              : u.currentPrice;
            const newSpark: PricePoint[] = [...d.spark, { ts: u.ts, price: u.currentPrice }];
            if (newSpark.length > HISTORY_LIMIT) newSpark.splice(0, newSpark.length - HISTORY_LIMIT);
            byId.set(u.drinkId, {
              ...d,
              currentPrice: u.currentPrice,
              displayPrice: Math.round(display * 100) / 100,
              spark: newSpark,
            });
          }
          const dyn = [...byId.values()].filter((d) => d.isDynamic);
          const idx = dyn.length
            ? dyn.reduce((s, d) => s + (d.currentPrice - d.basePrice) / d.basePrice, 0) / dyn.length
            : 0;
          return {
            ...prev,
            drinks: [...byId.values()],
            marketIndexPct: idx * 100,
            connectionStatus: "live",
          };
        });
      };
      es.addEventListener("price.tick", onTick);
      es.addEventListener("price.update", onTick);
      es.addEventListener("crash.started", (e) => {
        lastBeat = Date.now();
        const crashEvt = JSON.parse((e as MessageEvent).data) as CrashEvent;
        setState((prev) =>
          prev
            ? {
                ...prev,
                crash: { active: true, event: crashEvt, remainingSeconds: 0 },
              }
            : prev,
        );
      });
      es.addEventListener("crash.tick", (e) => {
        lastBeat = Date.now();
        const { remainingSeconds } = JSON.parse((e as MessageEvent).data) as {
          remainingSeconds: number;
        };
        setState((prev) =>
          prev
            ? {
                ...prev,
                crash: { ...prev.crash, remainingSeconds, active: remainingSeconds > 0 },
              }
            : prev,
        );
      });
      es.addEventListener("crash.ended", () => {
        lastBeat = Date.now();
        setState((prev) =>
          prev
            ? { ...prev, crash: { active: false, event: null, remainingSeconds: 0 } }
            : prev,
        );
      });
      es.addEventListener("drink.updated", () => {
        snapshot();
      });
      es.addEventListener("settings.updated", () => {
        snapshot();
      });
    };
    connect();

    return () => {
      clearInterval(beatTimer);
      if (offlineTimer) clearTimeout(offlineTimer);
      es?.close();
    };
  }, [snapshot]);

  return { state, refresh: snapshot };
}
