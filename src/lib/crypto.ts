import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(pin, salt, KEY_LEN).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  if (!stored.startsWith("scrypt$")) return false;
  const [, salt, hex] = stored.split("$");
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  let derived: Buffer;
  try {
    derived = scryptSync(pin, salt, KEY_LEN);
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
