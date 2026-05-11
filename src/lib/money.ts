export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function roundCurrency(amount: number): number {
  return fromCents(toCents(amount));
}

export function formatAud(amount: number): string {
  return `$${roundCurrency(amount).toFixed(2)}`;
}

export function pctChange(current: number, base: number): number {
  if (base <= 0) return 0;
  return ((current - base) / base) * 100;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}
