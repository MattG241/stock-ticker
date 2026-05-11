import { ulid } from "ulid";
import { recordAudit, store } from "../store";
import { nowIso } from "../time";
import { hashPin, verifyPin } from "../crypto";
import type { StaffMember, StaffRole } from "../types";

export function listStaff(): StaffMember[] {
  return [...store.staff.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function findStaffByPin(pin: string): StaffMember | null {
  for (const s of store.staff.values()) {
    if (s.isActive && verifyPin(pin, s.pinHash)) return s;
  }
  return null;
}

export function requireRole(pin: string, roles: StaffRole[]): StaffMember | null {
  const s = findStaffByPin(pin);
  if (!s) return null;
  return roles.includes(s.role) ? s : null;
}

export function upsertStaff(input: {
  id?: string;
  name: string;
  email: string;
  pin: string;
  role: StaffRole;
  isActive: boolean;
}): StaffMember {
  const id = input.id ?? `staff-${ulid().slice(-8)}`;
  const existing = store.staff.get(id);
  const next: StaffMember = {
    id,
    name: input.name,
    email: input.email,
    pinHash: hashPin(input.pin),
    role: input.role,
    isActive: input.isActive,
    createdAt: existing?.createdAt ?? nowIso(),
  };
  store.staff.set(id, next);
  recordAudit("admin", existing ? "staff.update" : "staff.create", { id, role: next.role });
  return next;
}

export function deactivateStaff(id: string): boolean {
  const s = store.staff.get(id);
  if (!s) return false;
  s.isActive = false;
  recordAudit("admin", "staff.deactivate", { id });
  return true;
}
