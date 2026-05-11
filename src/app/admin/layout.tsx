import Link from "next/link";
import { Logo } from "@/components/Logo";

const tabs = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/crash", label: "Crash Centre" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/market", label: "Market" },
  { href: "/admin/audit", label: "Audit" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-edge px-6 py-3 flex items-center justify-between">
        <Logo size={22} />
        <nav className="flex items-center gap-1">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="px-3 py-1.5 text-sm text-ink-dim hover:text-ink rounded-md hover:bg-bg-elev"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
