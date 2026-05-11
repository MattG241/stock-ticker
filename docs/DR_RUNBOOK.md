# Disaster Recovery Runbook

What to do when something is on fire.

## Tiers

| Tier | Meaning | Response |
|---|---|---|
| 1 | Bar is open, real customers being served | Restore service first, root-cause later |
| 2 | After hours / staging | Diagnose, fix, document |
| 3 | Pre-launch | Improve resilience |

## Restore order: which surfaces matter

1. **POS first.** If the POS can take payment, the night survives. Offline mode is the safety net.
2. **Display second.** A frozen display with last-known prices is acceptable. A JavaScript error on the display is not - reload the kiosk if it shows a stack trace.
3. **Admin and dashboard last.** These can be unreachable for hours without the bar suffering.

## Symptom -> action

### POS won't load on iPad

- Check WiFi. Try loading `https://<domain>/api/state/snapshot` in Safari. If 200 OK, reload the POS tab.
- If iPad is offline only: keep the existing tab open. Queued orders will drain on reconnect.

### Display shows JavaScript error

- Reload the kiosk. The display is read-only, so reloading is safe at any time.
- If error repeats: roll back to the previous deploy from the Railway dashboard.

### Tick engine appears frozen

- Hit `/api/state/snapshot` from a phone. Watch `serverTime`. If it advances but `currentPrice` does not over 10+ seconds, the scheduler crashed.
- Restart the Railway service. The tick engine bootstraps on first request.

### Crash stuck or runaway discount

- `DELETE /api/crash` ends it immediately, or click "End crash now" on `/admin/crash`.

### Postgres outage

- The in-memory store keeps working for the current process. Orders persist in process memory.
- Snapshot the in-memory orders manually with `curl /api/orders > emergency.json` until Postgres returns.
- When Postgres returns, ingest from the snapshot (no UI for this yet; manual SQL).

## Backups (production)

- Provision a nightly Postgres dump to S3-compatible storage via Railway's automated backups, OR run `pg_dump` from a cron job.
- Test restore quarterly: spin up a sandbox project, restore, verify the last day of orders.

## Incident comms

- During trading: do NOT post on social. Customers see the screens, not the dashboard.
- After close: write a short post-mortem in `BACKLOG.md` referencing the audit-log lines around the incident.

## Pre-launch hardening checklist

- [ ] `PAYMENT_PROVIDER=stripe` and real Stripe Terminal hardware on site
- [ ] `RECEIPT_PROVIDER=postmark` (or `twilio`) with verified domain
- [ ] `CRASH_WEBHOOK_TOKEN` is a strong random secret
- [ ] `DATABASE_URL` set to Railway Postgres with daily backups enabled
- [ ] Sentry DSN set, alert routes to phone
- [ ] Axiom or Better Stack ingestion for structured logs
- [ ] Uptime monitor pings `/api/state/snapshot` every 60s
- [ ] Run a 200-orders-in-5-minutes synthetic load test once
