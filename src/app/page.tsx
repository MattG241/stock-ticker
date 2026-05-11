import Link from "next/link";
import { Logo, BrandTagline } from "@/components/Logo";
import { BrassDivider, CornerFrame } from "@/components/Ornament";

export default function Home() {
  const surfaces: { href: string; group: string; label: string; sub: string }[] = [
    { group: "Customer", href: "/display?profile=main", label: "Display · Main", sub: "Full grid, behind the bar" },
    { group: "Customer", href: "/display?profile=tape", label: "Display · Tape", sub: "Scrolling ticker, narrow screens" },
    { group: "Customer", href: "/display?profile=featured", label: "Display · Featured", sub: "Three drinks, 30s rotation" },
    { group: "Staff", href: "/pos", label: "Point of Sale", sub: "Staff terminal, take orders" },
    { group: "Staff", href: "/bar", label: "Bar queue", sub: "Drinks to make, mark done" },
    { group: "Operator", href: "/admin", label: "Admin", sub: "Crashes · menu · market · audit" },
    { group: "Operator", href: "/dashboard", label: "Dashboard", sub: "Live analytics" },
  ];
  return (
    <main className="mx-auto max-w-4xl px-8 py-20">
      <CornerFrame className="px-10 py-12">
        <div className="flex flex-col items-center text-center">
          <span className="label-dim mb-3">Raise a glass · Trade stories</span>
          <Logo size={32} variant="stacked" showRule />
          <div className="mt-4">
            <BrandTagline size="md" />
          </div>
        </div>
      </CornerFrame>

      <BrassDivider withMark />

      <section className="mt-10">
        <h2 className="label">Surfaces</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {surfaces.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="panel transition hover:border-brass/60 hover:bg-bg-elev"
            >
              <div className="flex items-baseline justify-between">
                <span className="serif text-base font-semibold">{s.label}</span>
                <span className="label-dim">{s.group}</span>
              </div>
              <div className="mt-1 text-xs text-ink-dim">{s.sub}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10 panel">
        <h2 className="label">Build status</h2>
        <ul className="mt-3 space-y-1 text-xs text-ink/80">
          <li>Phase 1 · The Ticker · shipped</li>
          <li>Phase 2 · Manual + scheduled crashes · shipped</li>
          <li>Phase 3 · POS · shipped (Stripe Terminal adapter wired to SDK)</li>
          <li>Phase 4 · Admin + Dashboard · shipped (2FA pending)</li>
          <li>Phase 5 · Hardening · production safety pass complete</li>
        </ul>
        <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-brass-dim">
          State in process memory · Drizzle schema ready for Postgres at <span className="num">src/lib/db/schema.ts</span>
        </p>
      </section>
    </main>
  );
}
