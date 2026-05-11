import { ulid } from "ulid";
import { recordAudit, store } from "../store";
import { nowIso } from "../time";
import type { RefusalEntry } from "../types";

export function recordRefusal(input: {
  staffId: string;
  reason: RefusalEntry["reason"];
  notes: string;
}): RefusalEntry {
  const entry: RefusalEntry = {
    id: `rfs-${ulid().slice(-10)}`,
    ts: nowIso(),
    staffId: input.staffId,
    reason: input.reason,
    notes: input.notes,
  };
  store.refusals.unshift(entry);
  if (store.refusals.length > 500) store.refusals.length = 500;
  recordAudit(input.staffId, "service.refused", {
    refusalId: entry.id,
    reason: entry.reason,
    notes: entry.notes,
  });
  return entry;
}

export function listRefusals(limit = 50): RefusalEntry[] {
  return store.refusals.slice(0, limit);
}
