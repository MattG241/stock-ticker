"use client";
import { useEffect, useState } from "react";

interface Refusal {
  id: string;
  ts: string;
  staffId: string;
  reason: "intoxication" | "id" | "behaviour" | "other";
  notes: string;
}

export default function RefusalsPage() {
  const [items, setItems] = useState<Refusal[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/refusal", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItems(data.refusals ?? []);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="serif text-4xl font-semibold tracking-tight">RSA Refusals</h1>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-dim">
          Logged refusals of service · Liquor Licensing Act 1997 (SA) audit requirement
        </p>
      </div>
      {items.length === 0 ? (
        <p className="num text-[11px] uppercase tracking-[0.18em] text-ink-dim">[ no refusals logged ]</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="label text-left">
            <tr className="border-b border-edge">
              <th className="py-2">Time</th>
              <th>Staff</th>
              <th>Reason</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-edge/40 align-top">
                <td className="num py-2 text-ink-dim">{new Date(r.ts).toLocaleString("en-AU")}</td>
                <td>{r.staffId}</td>
                <td className="uppercase tracking-widest">{r.reason}</td>
                <td className="text-ink/80">{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
