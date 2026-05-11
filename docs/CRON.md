# Scheduled jobs

The Drink Exchange has three jobs that need to run on a schedule. They are
exposed as HTTP endpoints so any scheduler (Railway cron, Inngest, GitHub
Actions, Vercel Cron, plain `cron`) can call them.

## 03:00 ACDT - daily summary email

Calls `GET /api/dashboard/daily-summary?format=html` and pipes the body
to the receipt provider. Suitable for Inngest:

```ts
// inngest/jobs/daily-summary.ts
import { inngest } from "../client";
import fetch from "node-fetch";

export const dailySummary = inngest.createFunction(
  { id: "daily-summary" },
  { cron: "TZ=Australia/Adelaide 0 3 * * *" },
  async () => {
    const res = await fetch(`${process.env.APP_URL}/api/dashboard/daily-summary?format=html`);
    const html = await res.text();
    await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": process.env.POSTMARK_TOKEN!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        From: "ops@thedrinkexchange.com.au",
        To: process.env.OWNER_EMAIL,
        Subject: "Drink Exchange · daily summary",
        HtmlBody: html,
      }),
    });
  },
);
```

## 04:00 ACDT - Postgres backup

Run `scripts/backup-postgres.sh`. On Railway, add a cron service that runs
the same image with command `bash scripts/backup-postgres.sh`. Required env:

- `DATABASE_URL` (same as the app)
- `S3_BUCKET` and AWS creds, or any S3-compatible store

## Continuous - tick engine and crash scheduler

These run in-process. They start on the first HTTP request that hits an
`/api/*` route (via `src/lib/engine/bootstrap.ts`) and live for the
lifetime of the Node process. On Railway with sleeping enabled this means
they pause when traffic stops; either disable sleeping or set up an uptime
monitor that pings `/api/state/snapshot` every 60 seconds.
