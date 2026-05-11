"use client";
import { useEffect, useState } from "react";
import { formatAud } from "@/lib/money";
import type { Drink, DrinkCategory } from "@/lib/types";

type FormState = {
  id: string; // empty when creating, set when editing
  ticker: string;
  name: string;
  category: DrinkCategory;
  emoji: string;
  basePrice: string;
  currentPrice: string;
  costPrice: string;
  minPriceMultiplier: string;
  maxPriceMultiplier: string;
  isDynamic: boolean;
  isActive: boolean;
  sortOrder: string;
};

const CATEGORIES: DrinkCategory[] = ["Cocktails", "Beer", "Wine", "Spirits", "Shots", "Non-Alc"];

const EMPTY_FORM: FormState = {
  id: "",
  ticker: "",
  name: "",
  category: "Cocktails",
  emoji: "🍸",
  basePrice: "",
  currentPrice: "",
  costPrice: "",
  minPriceMultiplier: "0.5",
  maxPriceMultiplier: "2.5",
  isDynamic: true,
  isActive: true,
  sortOrder: "0",
};

function formFrom(d: Drink): FormState {
  return {
    id: d.id,
    ticker: d.ticker,
    name: d.name,
    category: d.category,
    emoji: d.emoji,
    basePrice: d.basePrice.toString(),
    currentPrice: d.currentPrice.toString(),
    costPrice: d.costPrice.toString(),
    minPriceMultiplier: d.minPriceMultiplier.toString(),
    maxPriceMultiplier: d.maxPriceMultiplier.toString(),
    isDynamic: d.isDynamic,
    isActive: d.isActive,
    sortOrder: d.sortOrder.toString(),
  };
}

export default function MenuPage() {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Drink | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/drinks", { cache: "no-store" });
      const data = await res.json();
      const list = (data.drinks ?? []) as Drink[];
      list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      setDrinks(list);
    } catch {
      setToast({ kind: "err", msg: "Could not load drinks" });
    }
  };
  useEffect(() => {
    load();
  }, []);

  const patch = async (id: string, body: Partial<Drink>) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/drinks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast({ kind: "err", msg: data.reason ?? "Update failed" });
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (d: Drink) => {
    setForm(formFrom(d));
    setFormError(null);
    setEditorOpen(true);
  };

  const submitForm = async () => {
    setFormError(null);
    const basePrice = parseFloat(form.basePrice);
    const costPrice = parseFloat(form.costPrice);
    const minMul = parseFloat(form.minPriceMultiplier);
    const maxMul = parseFloat(form.maxPriceMultiplier);
    const sortOrder = parseInt(form.sortOrder, 10);
    if (!form.ticker.trim()) return setFormError("Ticker is required");
    if (!form.name.trim()) return setFormError("Name is required");
    if (!(basePrice > 0)) return setFormError("Base price must be > 0");
    if (!(costPrice > 0)) return setFormError("Cost price must be > 0");
    if (!(minMul > 0)) return setFormError("Min multiplier must be > 0");
    if (!(maxMul > 0)) return setFormError("Max multiplier must be > 0");
    if (maxMul < minMul) return setFormError("Max multiplier must be >= min");
    if (!Number.isFinite(sortOrder)) return setFormError("Sort order must be a number");
    if (costPrice >= basePrice) {
      setFormError("Cost should be lower than base price (warning)");
      // Allow but warn - don't return.
    }

    const isCreate = !form.id;
    const url = "/api/drinks";
    const method = isCreate ? "POST" : "PATCH";

    const body: Record<string, unknown> = {
      ticker: form.ticker.trim().toUpperCase(),
      name: form.name.trim(),
      category: form.category,
      emoji: form.emoji,
      basePrice,
      costPrice,
      minPriceMultiplier: minMul,
      maxPriceMultiplier: maxMul,
      isDynamic: form.isDynamic,
      isActive: form.isActive,
      sortOrder,
    };
    if (isCreate) {
      // Server derives id from ticker if absent.
    } else {
      body.id = form.id;
      const currentPriceNum = parseFloat(form.currentPrice);
      if (Number.isFinite(currentPriceNum) && currentPriceNum > 0) {
        body.currentPrice = currentPriceNum;
      }
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFormError(data.reason ?? "Save failed");
        return;
      }
      setToast({ kind: "ok", msg: isCreate ? "Drink added" : "Drink updated" });
      setEditorOpen(false);
      await load();
    } catch {
      setFormError("Network error");
    }
  };

  const doDelete = async (d: Drink) => {
    setBusyId(d.id);
    try {
      const res = await fetch("/api/drinks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setToast({ kind: "err", msg: data.reason ?? "Delete failed" });
      } else {
        setToast({ kind: "ok", msg: `Deleted ${d.name}` });
      }
      setConfirmDelete(null);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="serif text-4xl font-semibold tracking-tight">Menu</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-brass-dim">
            Add · edit · delete · toggle active. Tickers, names and prices all editable.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          + Add drink
        </button>
      </div>
      {toast && (
        <p
          className={`text-[11px] uppercase tracking-[0.18em] ${
            toast.kind === "ok" ? "text-bull" : "text-bear"
          }`}
        >
          {toast.msg}
        </p>
      )}
      <table className="w-full text-xs">
        <thead className="text-left label">
          <tr className="border-b border-edge">
            <th className="py-2">Ticker</th>
            <th>Name</th>
            <th>Cat</th>
            <th className="text-right">Base</th>
            <th className="text-right">Now</th>
            <th className="text-right">Cost</th>
            <th className="text-center">Dyn</th>
            <th className="text-center">Active</th>
            <th className="text-center">Stock</th>
            <th className="text-right">Sort</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {drinks.map((d) => (
            <tr
              key={d.id}
              className={`border-b border-edge/40 last:border-0 ${d.isActive ? "" : "opacity-50"}`}
            >
              <td className="py-2">
                <span className="ticker-symbol">{d.ticker}</span>
              </td>
              <td className="text-ink/90">
                <span className="mr-1.5">{d.emoji}</span>
                {d.name}
              </td>
              <td className="text-ink-dim">{d.category}</td>
              <td className="num text-right">{formatAud(d.basePrice)}</td>
              <td className="num text-right">{formatAud(d.currentPrice)}</td>
              <td className="num text-right text-ink-dim">{formatAud(d.costPrice)}</td>
              <td className="text-center">
                <button
                  className="btn px-2 py-0.5"
                  onClick={() => patch(d.id, { isDynamic: !d.isDynamic })}
                  disabled={busyId === d.id}
                >
                  {d.isDynamic ? "Yes" : "No"}
                </button>
              </td>
              <td className="text-center">
                <button
                  className={`btn px-2 py-0.5 ${d.isActive ? "border-bull text-bull" : "border-bear text-bear"}`}
                  onClick={() => patch(d.id, { isActive: !d.isActive })}
                  disabled={busyId === d.id}
                >
                  {d.isActive ? "On" : "Off"}
                </button>
              </td>
              <td className="text-center">
                <button
                  className={`btn px-2 py-0.5 ${d.inStock ? "border-bull text-bull" : "border-bear text-bear"}`}
                  onClick={() => patch(d.id, { inStock: !d.inStock })}
                  disabled={busyId === d.id}
                  title={d.inStock ? "In stock - tap to 86" : "Out of stock - tap to restock"}
                >
                  {d.inStock ? "In" : "OUT"}
                </button>
              </td>
              <td className="num text-right text-ink-dim">{d.sortOrder}</td>
              <td className="text-right">
                <div className="flex justify-end gap-1">
                  <button
                    className="btn px-2 py-0.5"
                    disabled={busyId === d.id}
                    onClick={() => openEdit(d)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-danger px-2 py-0.5"
                    disabled={busyId === d.id}
                    onClick={() => setConfirmDelete(d)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {drinks.length === 0 && (
            <tr>
              <td colSpan={11} className="py-6 text-center num text-[11px] text-ink-dim">
                [ no drinks yet — tap "Add drink" ]
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 p-4">
          <div className="panel w-full max-w-lg">
            <h3 className="label">{form.id ? `Edit ${form.name || form.ticker}` : "Add drink"}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <label className="block">
                <span className="label">Ticker</span>
                <input
                  type="text"
                  maxLength={8}
                  value={form.ticker}
                  onChange={(e) =>
                    setForm({ ...form, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })
                  }
                  placeholder="ESPM"
                  className="mt-1 w-full rounded-sm px-2 py-1.5 num"
                />
              </label>
              <label className="block">
                <span className="label">Emoji</span>
                <input
                  type="text"
                  maxLength={4}
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                  className="mt-1 w-full rounded-sm px-2 py-1.5"
                />
              </label>
              <label className="col-span-2 block">
                <span className="label">Name</span>
                <input
                  type="text"
                  maxLength={80}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Espresso Martini"
                  className="mt-1 w-full rounded-sm px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="label">Category</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as DrinkCategory })}
                  className="mt-1 w-full rounded-sm px-2 py-1.5"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Sort order</span>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  className="mt-1 w-full rounded-sm px-2 py-1.5 num"
                />
              </label>
              <label className="block">
                <span className="label">Base price ($)</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.basePrice}
                  onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                  className="mt-1 w-full rounded-sm px-2 py-1.5 num"
                />
              </label>
              <label className="block">
                <span className="label">Cost price ($)</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                  className="mt-1 w-full rounded-sm px-2 py-1.5 num"
                />
              </label>
              {form.id && (
                <label className="col-span-2 block">
                  <span className="label">Current price ($) — override</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={form.currentPrice}
                    onChange={(e) => setForm({ ...form, currentPrice: e.target.value })}
                    className="mt-1 w-full rounded-sm px-2 py-1.5 num"
                  />
                  <p className="mt-1 text-[10px] text-ink-dim">
                    Leave matching current to skip override. Logged in audit.
                  </p>
                </label>
              )}
              <label className="block">
                <span className="label">Min multiplier</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.minPriceMultiplier}
                  onChange={(e) => setForm({ ...form, minPriceMultiplier: e.target.value })}
                  className="mt-1 w-full rounded-sm px-2 py-1.5 num"
                />
              </label>
              <label className="block">
                <span className="label">Max multiplier</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.maxPriceMultiplier}
                  onChange={(e) => setForm({ ...form, maxPriceMultiplier: e.target.value })}
                  className="mt-1 w-full rounded-sm px-2 py-1.5 num"
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={form.isDynamic}
                  onChange={(e) => setForm({ ...form, isDynamic: e.target.checked })}
                  className="h-3.5 w-3.5"
                />
                <span>Dynamic (price fluctuates)</span>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-3.5 w-3.5"
                />
                <span>Active (shown on ticker)</span>
              </label>
            </div>
            {formError && (
              <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-bear">{formError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditorOpen(false)} className="btn">
                Cancel
              </button>
              <button onClick={submitForm} className="btn-primary">
                {form.id ? "Save" : "Add drink"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 p-4">
          <div className="panel w-full max-w-sm">
            <h3 className="label">Delete drink</h3>
            <p className="mt-3 text-sm">
              Remove <span className="font-semibold">{confirmDelete.name}</span> ({confirmDelete.ticker})
              from the menu?
            </p>
            <p className="mt-2 text-[11px] text-ink-dim">
              Historical orders keep their name snapshot. This cannot be undone (you can re-add later
              with a new id).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="btn">
                Cancel
              </button>
              <button
                onClick={() => doDelete(confirmDelete)}
                disabled={busyId === confirmDelete.id}
                className="btn-danger"
              >
                {busyId === confirmDelete.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
