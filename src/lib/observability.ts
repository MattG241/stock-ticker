/**
 * Observability hooks. When SENTRY_DSN is set, install @sentry/node and
 * wire it up in your bootstrap. Until then this is a console fallback so
 * the code path is consistent.
 *
 * To enable:
 *   npm install @sentry/node
 *   set SENTRY_DSN in env
 *   call ensureSentry() and capture(err) from your API route boundaries.
 */

let sentryReady = false;
type SentryModule = {
  init: (cfg: { dsn: string; tracesSampleRate?: number; environment?: string }) => void;
  captureException: (err: unknown, ctx?: { extra?: Record<string, unknown> }) => void;
};
let sentry: SentryModule | null = null;

export async function ensureSentry(): Promise<void> {
  if (sentryReady) return;
  if (!process.env.SENTRY_DSN) return;
  try {
    // Dynamic ESM specifier so the build does not fail when the optional
    // dep is missing. Install @sentry/node before enabling.
    const specifier = "@sentry/node";
    const mod = (await import(specifier).catch(() => null)) as SentryModule | null;
    if (!mod) return;
    mod.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });
    sentry = mod;
    sentryReady = true;
  } catch {
    // best effort
  }
}

export function capture(err: unknown, context?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureException(err, { extra: context });
    return;
  }
  console.error("[capture]", err, context);
}
