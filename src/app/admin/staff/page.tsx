"use client";
import { useEffect, useState } from "react";

interface StaffRow {
  id: string;
  name: string;
  email: string;
  pin: string;
  role: "staff" | "manager" | "admin" | "owner";
  isActive: boolean;
}

const blank: Omit<StaffRow, "id"> = {
  name: "",
  email: "",
  pin: "",
  role: "staff",
  isActive: true,
};

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [draft, setDraft] = useState<Omit<StaffRow, "id">>(blank);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/staff", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setStaff(data.staff ?? []);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) setMsg(data.reason ?? "Failed");
    else {
      setMsg("Saved");
      setDraft(blank);
      load();
    }
  };

  const deactivate = async (id: string) => {
    await fetch(`/api/staff?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-widest">STAFF</h1>
      <p className="text-sm text-ink-dim">
        Add staff, assign roles, deactivate. PINs are stored in plaintext in this in-memory store
        for development. Hash with Better Auth or Clerk before launch.
      </p>

      <section className="card">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">Add or update</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
          <input
            placeholder="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="rounded-lg border border-edge bg-bg-elev px-3 py-2"
          />
          <input
            placeholder="Email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            className="rounded-lg border border-edge bg-bg-elev px-3 py-2"
          />
          <input
            placeholder="PIN (4-6 digits)"
            inputMode="numeric"
            value={draft.pin}
            maxLength={6}
            onChange={(e) =>
              setDraft({ ...draft, pin: e.target.value.replace(/\D/g, "") })
            }
            className="rounded-lg border border-edge bg-bg-elev px-3 py-2 num"
          />
          <select
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value as StaffRow["role"] })}
            className="rounded-lg border border-edge bg-bg-elev px-3 py-2"
          >
            <option value="staff">staff</option>
            <option value="manager">manager</option>
            <option value="admin">admin</option>
            <option value="owner">owner</option>
          </select>
          <button onClick={save} className="btn-primary">Save</button>
        </div>
        {msg && <p className="mt-3 text-sm text-ink-dim">{msg}</p>}
      </section>

      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-ink-dim">
          <tr>
            <th className="py-2">Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>PIN</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id} className="border-t border-edge">
              <td className="py-2">{s.name}</td>
              <td className="text-ink-dim">{s.email}</td>
              <td>{s.role}</td>
              <td className="num">{s.pin}</td>
              <td>{s.isActive ? "Yes" : "No"}</td>
              <td className="text-right">
                {s.isActive && (
                  <button onClick={() => deactivate(s.id)} className="btn text-xs">
                    Deactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
