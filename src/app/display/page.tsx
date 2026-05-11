import { Suspense } from "react";
import { DisplayClient } from "./client";

export const dynamic = "force-dynamic";

export default function DisplayPage() {
  return (
    <Suspense fallback={<div className="p-10 text-ink-dim">Loading market...</div>}>
      <DisplayClient />
    </Suspense>
  );
}
