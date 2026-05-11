import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function Home() {
  const links: { href: string; label: string; sub: string }[] = [
    { href: "/display?profile=main", label: "Display - Main", sub: "Full grid, behind the bar" },
    { href: "/display?profile=tape", label: "Display - Tape", sub: "Scrolling ticker only" },
    { href: "/display?profile=featured", label: "Display - Featured", sub: "Three drinks, rotating" },
    { href: "/pos", label: "POS", sub: "Staff tablet, take orders" },
    { href: "/admin", label: "Admin", sub: "Crashes, menu, market, audit" },
    { href: "/dashboard", label: "Dashboard", sub: "Live analytics" },
  ];
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Logo size={36} />
      <p className="mt-2 text-ink-dim">Trade Drinks. Not Stocks.</p>

      <h1 className="mt-12 text-2xl font-semibold">Clients</h1>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card hover:border-bull transition">
            <div className="text-sm font-semibold">{l.label}</div>
            <div className="text-xs text-ink-dim mt-1">{l.sub}</div>
          </Link>
        ))}
      </div>

      <section className="mt-12 card">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-dim">Build status</h2>
        <ul className="mt-3 text-sm space-y-1.5">
          <li>Phase 1 - The Ticker: shipped</li>
          <li>Phase 2 - Manual Crashes: shipped</li>
          <li>Phase 3 - POS: order placement and price impact shipped; payment provider stubbed</li>
          <li>Phase 4 - Admin and Dashboard: core screens shipped, 2FA pending</li>
          <li>Phase 5 - Hardening: pending</li>
        </ul>
        <p className="text-xs text-ink-dim mt-4">
          State persists in process memory for development. Drizzle schema for Postgres is included
          at <span className="num">src/lib/db/schema.ts</span>; wire up <span className="num">DATABASE_URL</span> on Railway and
          run migrations before launch.
        </p>
      </section>
    </main>
  );
}
