import Link from "next/link";
import { Logo } from "@/components/Logo";

const tabs = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/crash", label: "Crash" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/market", label: "Market" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/shifts", label: "Shifts" },
  { href: "/admin/audit", label: "Audit" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-edge bg-bg-card/50 px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between py-3">
          <Logo size={22} />
          <nav className="flex items-center gap-1">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="rounded-sm px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-ink-dim transition hover:bg-bg-elev hover:text-ink"
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
