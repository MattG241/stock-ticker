"use client";
import { useEffect, useState } from "react";
import type { AuditEntry } from "@/lib/types";

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/audit", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      }
    };
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <h1 className="serif text-4xl font-semibold tracking-tight mb-4">Audit Log</h1>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-dim">No entries yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-ink-dim">
            <tr>
              <th className="py-2 w-44">Time</th>
              <th className="w-32">Actor</th>
              <th className="w-44">Action</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-edge align-top">
                <td className="py-2 num text-ink-dim">{new Date(e.ts).toLocaleString("en-AU")}</td>
                <td>{e.actor}</td>
                <td>{e.action}</td>
                <td className="num text-xs text-ink-dim">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(e.detail, null, 2)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
