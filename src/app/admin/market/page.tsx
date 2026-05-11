"use client";
import { useEffect, useState } from "react";
import type { Settings } from "@/lib/types";

export default function MarketPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSettings(d.settings));
  }, []);

  const update = async (patch: Partial<Settings>) => {
    setMsg(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) setMsg(data.reason ?? "Failed");
    else {
      setSettings(data.settings);
      setMsg("Saved");
    }
  };

  if (!settings) return <div className="text-ink-dim">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-widest">MARKET PARAMETERS</h1>
      <p className="text-sm text-ink-dim">Applies on the next tick (every 2 seconds).</p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Slider
          label="Volatility (per-unit order impact)"
          value={settings.volatility}
          min={0}
          max={0.2}
          step={0.005}
          format={(v) => v.toFixed(3)}
          onCommit={(v) => update({ volatility: v })}
        />
        <Slider
          label="Decay rate (mean reversion)"
          value={settings.decayRate}
          min={0}
          max={0.2}
          step={0.005}
          format={(v) => v.toFixed(3)}
          onCommit={(v) => update({ decayRate: v })}
        />
        <Slider
          label="Noise level"
          value={settings.noiseLevel}
          min={0}
          max={0.02}
          step={0.001}
          format={(v) => v.toFixed(4)}
          onCommit={(v) => update({ noiseLevel: v })}
        />
        <Slider
          label="Margin floor (1 + N) above cost during crash"
          value={settings.minMarginMultiplier}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onCommit={(v) => update({ minMarginMultiplier: v })}
        />
        <Slider
          label="Per-shift max crash discount"
          value={settings.perShiftMaxDiscount}
          min={0.1}
          max={0.9}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onCommit={(v) => update({ perShiftMaxDiscount: v })}
        />
        <Slider
          label="Crash cooldown (minutes)"
          value={settings.crashCooldownMs / 60000}
          min={0}
          max={60}
          step={1}
          format={(v) => `${v} min`}
          onCommit={(v) => update({ crashCooldownMs: Math.round(v) * 60000 })}
        />
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">Trading hours (Australia/Adelaide)</h2>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            defaultValue={settings.tradingOpen}
            placeholder="16:00"
            onBlur={(e) => update({ tradingOpen: e.target.value })}
            className="rounded-lg border border-edge bg-bg-elev px-3 py-2 num text-sm w-24"
          />
          <span className="text-ink-dim">to</span>
          <input
            type="text"
            defaultValue={settings.tradingClose}
            placeholder="02:00"
            onBlur={(e) => update({ tradingClose: e.target.value })}
            className="rounded-lg border border-edge bg-bg-elev px-3 py-2 num text-sm w-24"
          />
        </div>
      </div>

      {msg && <p className="text-sm text-ink-dim">{msg}</p>}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (n: number) => string;
  onCommit: (n: number) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="card block">
      <div className="text-xs uppercase tracking-widest text-ink-dim">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => setV(parseFloat(e.target.value))}
        onMouseUp={() => onCommit(v)}
        onTouchEnd={() => onCommit(v)}
        className="mt-2 w-full"
      />
      <div className="num text-xl font-bold">{format(v)}</div>
    </label>
  );
}
