import { store } from "../store";
import { roundCurrency } from "../money";

export function revenuePerHour(date: Date = new Date()): { hour: string; revenue: number; orders: number }[] {
  const tzFmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Adelaide",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const key = tzFmt.format(date);
  const buckets = new Map<string, { revenue: number; orders: number }>();
  for (let h = 0; h < 24; h++) buckets.set(h.toString().padStart(2, "0"), { revenue: 0, orders: 0 });
  for (const o of store.orders) {
    if (o.status !== "paid") continue;
    const d = new Date(o.createdAt);
    if (tzFmt.format(d) !== key) continue;
    const hh = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Adelaide",
      hour: "2-digit",
      hour12: false,
    }).format(d);
    const b = buckets.get(hh) ?? { revenue: 0, orders: 0 };
    b.revenue = roundCurrency(b.revenue + o.total);
    b.orders += 1;
    buckets.set(hh, b);
  }
  return [...buckets.entries()].map(([hour, v]) => ({ hour, ...v }));
}

export function dailySummary(): {
  date: string;
  revenue: number;
  orders: number;
  topSeller: { name: string; count: number } | null;
  topMover: { name: string; pctChange: number } | null;
  crashes: number;
} {
  const today = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Adelaide",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todays = store.orders.filter((o) => {
    if (o.status !== "paid") return false;
    return (
      new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Adelaide",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(o.createdAt)) === today
    );
  });
  const revenue = roundCurrency(todays.reduce((s, o) => s + o.total, 0));
  const counts = new Map<string, { name: string; count: number }>();
  for (const o of todays) {
    for (const l of o.lines) {
      const c = counts.get(l.drinkId) ?? { name: l.drinkNameSnapshot, count: 0 };
      c.count += l.quantity;
      counts.set(l.drinkId, c);
    }
  }
  const topSeller =
    [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null;
  const movers = [...store.drinks.values()]
    .filter((d) => d.isDynamic)
    .map((d) => ({ name: d.name, pctChange: ((d.currentPrice - d.basePrice) / d.basePrice) * 100 }))
    .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
  return {
    date: today,
    revenue,
    orders: todays.length,
    topSeller,
    topMover: movers[0] ?? null,
    crashes: store.crashHistory.length,
  };
}

export function dailySummaryHtml(): string {
  const s = dailySummary();
  return `
<!doctype html>
<html><body style="font-family:Inter,system-ui,sans-serif;background:#0b0b0c;color:#fafafa;padding:24px">
  <h1 style="margin:0 0 8px;font-family:Bebas Neue,sans-serif;letter-spacing:.15em">THE DRINK EXCHANGE</h1>
  <p style="margin:0 0 24px;color:#a1a1aa">Daily summary - ${s.date}</p>
  <table style="border-collapse:collapse">
    <tr><td style="padding:6px 16px 6px 0;color:#a1a1aa">Revenue</td><td style="padding:6px 0">$${s.revenue.toFixed(2)}</td></tr>
    <tr><td style="padding:6px 16px 6px 0;color:#a1a1aa">Orders</td><td style="padding:6px 0">${s.orders}</td></tr>
    <tr><td style="padding:6px 16px 6px 0;color:#a1a1aa">Crashes</td><td style="padding:6px 0">${s.crashes}</td></tr>
    <tr><td style="padding:6px 16px 6px 0;color:#a1a1aa">Top seller</td><td style="padding:6px 0">${s.topSeller ? `${s.topSeller.name} x ${s.topSeller.count}` : "n/a"}</td></tr>
    <tr><td style="padding:6px 16px 6px 0;color:#a1a1aa">Biggest mover</td><td style="padding:6px 0">${s.topMover ? `${s.topMover.name} (${s.topMover.pctChange.toFixed(2)}%)` : "n/a"}</td></tr>
  </table>
</body></html>`;
}
