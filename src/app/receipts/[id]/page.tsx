import { store } from "@/lib/store";
import "@/lib/engine/bootstrap";
import { renderReceiptText } from "@/lib/providers/receipt";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = store.orders.find((o) => o.id === id);
  if (!order) notFound();
  const txt = renderReceiptText(order);
  return (
    <main className="mx-auto max-w-md p-8">
      <pre className="num whitespace-pre-wrap text-sm leading-6 text-ink">{txt}</pre>
    </main>
  );
}
