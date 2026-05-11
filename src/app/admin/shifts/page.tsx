"use client";
import { useEffect, useState } from "react";
import { formatAud } from "@/lib/money";
import type { Shift, ZReport } from "@/lib/types";

export default function ShiftsPage() {
  const [data, setData] = useState<{ current: Shift | null; history: Shift[] } | null>(null);
  const [zReport, setZReport] = useState<ZReport | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/shift", { cache: "no-store" });
    if (res.ok) {
      const d = await res.json();
      setData({ current: d.current, history: d.history });
    }
  };
  useEffect(() => {
    load();
  }, []);

  const open = async () => {
    await fetch("/api/shift/open", { method: "POST", body: JSON.stringify({ openedBy: "admin" }) });
    load();
  };
  const close = async () => {
    const res = await fetch("/api/shift/close", {
      method: "POST",
      body: JSON.stringify({ closedBy: "admin" }),
    });
    const d = await res.json();
    if (d.ok) {
      setZReport(d.zReport);
      setMsg(`Shift closed - Z-report mailed (console provider) to ownership`);
    } else {
      setMsg(d.reason);
    }
    load();
  };

  if (!data) return <div className="text-ink-dim">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-widest">SHIFTS</h1>
      <section className="card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-ink-dim">Current shift</div>
            <div className="num text-lg">{data.current?.id ?? "(none)"}</div>
            <div className="text-xs text-ink-dim">
              {data.current
                ? `Opened ${new Date(data.current.openedAt).toLocaleString("en-AU")}${
                    data.current.closedAt
                      ? `, closed ${new Date(data.current.closedAt).toLocaleString("en-AU")}`
                      : ""
                  }`
                : ""}
            </div>
          </div>
          <div className="flex gap-2">
            {!data.current || data.current.closedAt ? (
              <button onClick={open} className="btn-primary">Open shift</button>
            ) : (
              <button onClick={close} className="btn-danger">Close shift</button>
            )}
          </div>
        </div>
        {msg && <p className="mt-3 text-sm text-ink-dim">{msg}</p>}
      </section>

      {zReport && (
        <section className="card">
          <h2 className="font-display text-2xl tracking-widest">Z-REPORT</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
            <li><span className="text-ink-dim">Revenue</span> <span className="num ml-2">{formatAud(zReport.revenue)}</span></li>
            <li><span className="text-ink-dim">Ex-GST</span> <span className="num ml-2">{formatAud(zReport.subtotalExGst)}</span></li>
            <li><span className="text-ink-dim">GST</span> <span className="num ml-2">{formatAud(zReport.gst)}</span></li>
            <li><span className="text-ink-dim">Orders</span> <span className="num ml-2">{zReport.orders}</span></li>
            <li><span className="text-ink-dim">COGS est</span> <span className="num ml-2">{formatAud(zReport.cogsEstimate)}</span></li>
            <li><span className="text-ink-dim">Crashes</span> <span className="num ml-2">{zReport.crashCount} ({formatAud(zReport.crashRevenue)})</span></li>
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">History</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-ink-dim">
            <tr><th>Shift</th><th>Opened</th><th>Closed</th><th>Revenue</th></tr>
          </thead>
          <tbody>
            {data.history.map((s) => (
              <tr key={s.id} className="border-t border-edge">
                <td className="num py-1">{s.id}</td>
                <td>{new Date(s.openedAt).toLocaleString("en-AU")}</td>
                <td>{s.closedAt ? new Date(s.closedAt).toLocaleString("en-AU") : "open"}</td>
                <td className="num">{s.zReport ? formatAud(s.zReport.revenue) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">Exports</h2>
        <p className="mt-2 text-sm">
          <a href="/api/bas" className="text-bull underline">Download BAS CSV</a> -
          GST-broken-out orders ready for quarterly reporting.
        </p>
        <p className="mt-1 text-sm">
          <a href="/api/dashboard/daily-summary?format=html" target="_blank" rel="noreferrer" className="text-bull underline">View daily summary (HTML)</a> -
          this is what owners receive every morning at 03:00 ACDT.
        </p>
      </section>
    </div>
  );
}
