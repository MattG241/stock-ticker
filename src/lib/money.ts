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

// AU cash rounding: 1c and 2c coins were withdrawn in 1992. Cash totals
// round to the nearest 5c (down on .1/.2, up on .3/.4 etc - the standard
// "round-half-to-even" of 0.025 lands at 0.00). Card payment is exact.
export function roundCashAud(amount: number): number {
  const cents = Math.round(amount * 100);
  const remainder = cents % 5;
  const rounded = remainder < 3 ? cents - remainder : cents + (5 - remainder);
  return rounded / 100;
}
