import { store } from "@/lib/store";
import "@/lib/engine/bootstrap";
import { renderReceiptText } from "@/lib/providers/receipt";
import { Logo, BrandTagline } from "@/components/Logo";
import { BrassDivider } from "@/components/Ornament";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = store.orders.find((o) => o.id === id);
  if (!order) notFound();
  const txt = renderReceiptText(order);
  return (
    <main className="mx-auto max-w-md p-8">
      <div className="panel">
        <div className="flex flex-col items-center gap-2 pb-4">
          <Logo size={18} variant="stacked" />
          <BrandTagline size="sm" />
        </div>
        <BrassDivider withMark />
        <pre className="mt-4 num whitespace-pre-wrap text-[11px] leading-6 text-ink/90">{txt}</pre>
      </div>
    </main>
  );
}
