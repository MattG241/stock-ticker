"use client";
import { useEffect, useState } from "react";
import { useLiveState } from "@/lib/hooks/useLiveState";
import { formatAud } from "@/lib/money";

interface CrashRecord {
  id: string;
  startedAt: string;
  endsAt: string;
  discountPercent: number;
  cancelledEarly: boolean;
  totalOrdersDuringCrash: number;
  totalRevenueDuringCrash: number;
}

interface Schedule {
  id: string;
  fireAt: string;
  discountPercent: number;
  durationSeconds: number;
  label?: string;
  fired: boolean;
  cancelled: boolean;
}

export default function CrashCentre() {
  const { state } = useLiveState();
  const [discount, setDiscount] = useState(0.3);
  const [duration, setDuration] = useState(180);
  const [history, setHistory] = useState<CrashRecord[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scheduleAt, setScheduleAt] = useState<string>("");
  const [scheduleDiscount, setScheduleDiscount] = useState(0.25);
  const [scheduleDuration, setScheduleDuration] = useState(180);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const refreshHistory = async () => {
    const [crashRes, schedRes] = await Promise.all([
      fetch("/api/crash", { cache: "no-store" }),
      fetch("/api/crash/schedule", { cache: "no-store" }),
    ]);
    if (crashRes.ok) {
      const data = (await crashRes.json()) as { history: CrashRecord[] };
      setHistory(data.history ?? []);
    }
    if (schedRes.ok) {
      const data = (await schedRes.json()) as { schedules: Schedule[] };
      setSchedules(data.schedules ?? []);
    }
  };

  useEffect(() => {
    refreshHistory();
    const t = setInterval(refreshHistory, 5000);
    return () => clearInterval(t);
  }, []);

  const addSchedule = async () => {
    if (!scheduleAt) return;
    const fireAt = new Date(scheduleAt).toISOString();
    const res = await fetch("/api/crash/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fireAt,
        discountPercent: scheduleDiscount,
        durationSeconds: scheduleDuration,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) setMsg(data.reason ?? "Failed");
    refreshHistory();
  };

  const cancelSchedule = async (id: string) => {
    await fetch(`/api/crash/schedule?id=${id}`, { method: "DELETE" });
    refreshHistory();
  };

  const trigger = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/crash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discountPercent: discount,
        durationSeconds: duration,
        triggeredBy: "admin",
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) setMsg(data.reason ?? "Failed");
    else setMsg(`Crash started`);
    setBusy(false);
    setConfirming(false);
    refreshHistory();
  };

  const endNow = async () => {
    setBusy(true);
    await fetch("/api/crash", { method: "DELETE" });
    setBusy(false);
    refreshHistory();
  };

  if (!state) return <div className="text-ink-dim">Loading...</div>;
  const active = state.crash.active;
  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="font-display text-3xl tracking-widest">CRASH CENTRE</h1>
        <p className="mt-1 text-sm text-ink-dim">Trigger a market-wide discount across every dynamic drink.</p>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-ink-dim">Discount</span>
            <input
              type="range"
              min={0.05}
              max={Math.min(0.9, state.settings.perShiftMaxDiscount)}
              step={0.05}
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value))}
              className="mt-2 w-full"
            />
            <div className="num text-2xl font-bold">{Math.round(discount * 100)}%</div>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-ink-dim">Duration (seconds)</span>
            <input
              type="range"
              min={30}
              max={600}
              step={15}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10))}
              className="mt-2 w-full"
            />
            <div className="num text-2xl font-bold">{duration}s</div>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {active ? (
            <button onClick={endNow} disabled={busy} className="btn-danger">End crash now</button>
          ) : (
            <button onClick={() => setConfirming(true)} disabled={busy} className="btn-danger text-lg">
              TRIGGER CRASH NOW
            </button>
          )}
          {active && (
            <span className="pill bg-bear/15 text-bear">
              ACTIVE - {state.crash.remainingSeconds}s left
            </span>
          )}
          {msg && <span className="text-sm text-ink-dim">{msg}</span>}
        </div>
      </section>

      <section className="card">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">Scheduled crashes</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="rounded-lg border border-edge bg-bg-elev px-3 py-2 num text-sm"
          />
          <label className="text-sm">
            <span className="text-xs uppercase tracking-widest text-ink-dim">Discount</span>
            <input
              type="number"
              step="0.05"
              min={0.05}
              max={0.9}
              value={scheduleDiscount}
              onChange={(e) => setScheduleDiscount(parseFloat(e.target.value))}
              className="mt-1 w-full rounded-lg border border-edge bg-bg-elev px-3 py-2 num"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase tracking-widest text-ink-dim">Duration (s)</span>
            <input
              type="number"
              min={10}
              max={600}
              value={scheduleDuration}
              onChange={(e) => setScheduleDuration(parseInt(e.target.value, 10) || 0)}
              className="mt-1 w-full rounded-lg border border-edge bg-bg-elev px-3 py-2 num"
            />
          </label>
          <button onClick={addSchedule} className="btn-primary">Schedule</button>
        </div>
        {schedules.length === 0 ? (
          <p className="mt-3 text-sm text-ink-dim">No scheduled crashes.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-ink-dim">
              <tr><th>Fire at</th><th>Discount</th><th>Duration</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-t border-edge">
                  <td className="num py-1">{new Date(s.fireAt).toLocaleString("en-AU")}</td>
                  <td className="num">{Math.round(s.discountPercent * 100)}%</td>
                  <td className="num">{s.durationSeconds}s</td>
                  <td>{s.cancelled ? "cancelled" : s.fired ? "fired" : "pending"}</td>
                  <td className="text-right">
                    {!s.fired && !s.cancelled && (
                      <button className="btn text-xs" onClick={() => cancelSchedule(s.id)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-ink-dim">
          Social crash webhook URL: <code className="num">POST /api/crash/webhook/dev-webhook-token</code>.
          Override the token via <code className="num">CRASH_WEBHOOK_TOKEN</code>. Rate limited to one fire per minute.
        </p>
      </section>

      <section className="card">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">Recent crashes</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-ink-dim">No crashes yet this session.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-ink-dim">
              <tr>
                <th className="py-1">Started</th>
                <th>Discount</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>End</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-edge">
                  <td className="py-1 num">{new Date(h.startedAt).toLocaleTimeString("en-AU")}</td>
                  <td className="num">{Math.round(h.discountPercent * 100)}%</td>
                  <td className="num">{h.totalOrdersDuringCrash}</td>
                  <td className="num">{formatAud(h.totalRevenueDuringCrash)}</td>
                  <td>{h.cancelledEarly ? "Early" : "Timer"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80">
          <div className="card max-w-md">
            <h3 className="text-lg font-semibold">Trigger crash?</h3>
            <p className="mt-2 text-sm text-ink-dim">
              This will discount every dynamic drink by {Math.round(discount * 100)}% for {duration}s.
              Proceed?
            </p>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setConfirming(false)} className="btn">Cancel</button>
              <button onClick={trigger} disabled={busy} className="btn-danger">Trigger</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
