import "@/lib/engine/bootstrap";
import { store } from "@/lib/store";
import type { RealtimeEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // controller may already be closed
        }
      };
      send(`: connected\n\n`);
      const handler = (evt: RealtimeEvent) => {
        send(`event: ${evt.type}\ndata: ${JSON.stringify(evt.payload)}\n\n`);
      };
      const keepalive = setInterval(() => send(`: ping ${Date.now()}\n\n`), 20000);
      store.emitter.on("event", handler);
      const cleanup = () => {
        clearInterval(keepalive);
        store.emitter.off("event", handler);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      // @ts-expect-error - non-standard but commonly available
      controller.signal?.addEventListener?.("abort", cleanup);
      return cleanup;
    },
    cancel() {
      // handled via signal cleanup above
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
