# The Drink Exchange

Live pricing, point-of-sale, and customer-display system for a market-driven cocktail bar.
Prices float in real time like a stock exchange; the operator can trigger "market crashes"
that discount every dynamic drink for a short window.

## Build status

| Phase | This repo |
|---|---|
| Phase 1 - The Ticker | shipped |
| Phase 2 - Manual + scheduled crashes | shipped |
| Phase 3 - POS | shipped (Stripe Terminal adapter wired to the real SDK; needs hardware to verify) |
| Phase 4 - Admin and Dashboard | shipped (TOTP 2FA still pending) |
| Phase 5 - Hardening | shipped: Postgres write-through, backup script, daily-summary cron docs, Sentry stub, idempotency, AU cash 5c rounding, ATO-compliant receipts, RSA refusal log, closing bell |

`BACKLOG.md` lists everything that genuinely needs an external account before launch.

## Production safety checklist

Before the first paying customer:

- [ ] `DATABASE_URL` set to a Railway Postgres instance. Schema migrated (`npm run db:migrate`). Orders, audit, and shifts journal to Postgres on every write.
- [ ] `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY` and `STRIPE_TERMINAL_READER_ID` set. A BBPOS WisePOS E reader is registered and tested with a $1 charge.
- [ ] `RECEIPT_PROVIDER` set to `postmark` or `twilio`, with credentials.
- [ ] `BUSINESS_NAME`, `BUSINESS_ABN`, `BUSINESS_ADDRESS` set so receipts are ATO-compliant tax invoices.
- [ ] `SEED_OWNER_PIN`, `SEED_MANAGER_PIN`, `SEED_STAFF_PIN` rotated and added to Railway secrets (PINs are hashed with scrypt at rest).
- [ ] `CRASH_WEBHOOK_TOKEN` rotated to a strong random secret.
- [ ] `SENTRY_DSN` set; alerts route to phone.
- [ ] An uptime monitor pings `/api/state/snapshot` every 60s.
- [ ] Nightly Postgres backup via `scripts/backup-postgres.sh` running on Railway cron (see `docs/CRON.md`).
- [ ] Daily summary email scheduled for 03:00 ACDT (see `docs/CRON.md`).
- [ ] Operator has read `docs/OPERATOR_MANUAL.md`; staff have `docs/STAFF_CHEAT_SHEET.md` behind the bar.

## Quick start (dev)

```bash
npm install
npm run dev
```

Surfaces:

- `/` - landing
- `/display?profile=main|tape|featured` - customer-facing screens (load `?audio=skip` on kiosks)
- `/pos` - staff POS
- `/bar` - drinks queue for the person making them
- `/admin` - admin overview
- `/admin/crash`, `/admin/menu`, `/admin/market`, `/admin/staff`, `/admin/shifts`, `/admin/refusals`, `/admin/audit`
- `/dashboard` - live analytics

## Pricing engine (src/lib/engine/)

Tick every 2s, dynamic drinks only:

```
drift   = (basePrice - currentPrice) * decayRate         // 0.04
noise   = (random in [-1, +1]) * basePrice * noiseLevel  // 0.004
newPrice = clamp(currentPrice + drift + noise, min, max)
```

Order impact when an order is placed:

```
impact   = (1 + volatility) ^ quantity                   // 0.05
newPrice = min(currentPrice * impact, basePrice * maxMul)
```

Crash discount, with a margin floor:

```
displayPrice = max(currentPrice * (1 - discountPercent),
                   costPrice * (1 + minMarginMultiplier))
```

Trading-hours hard-stop is checked on tick and on order placement.
Outside hours, dynamic prices freeze and the display shows `MARKET CLOSED`.

## Provider adapters

`src/lib/providers/payment.ts` and `src/lib/providers/receipt.ts` are
interfaces with a `simulated` dev implementation and adapters for:

- Stripe Terminal (real SDK calls; needs `STRIPE_SECRET_KEY` + `STRIPE_TERMINAL_READER_ID`)
- Square (scaffolded, not implemented)
- Twilio SMS (scaffolded)
- Postmark email (scaffolded)
- Console (logs in dev)

Set `PAYMENT_PROVIDER` / `RECEIPT_PROVIDER` env vars to swap.

## Production-safe behaviours

- **Idempotency**: every POS `POST /api/orders` carries an `idempotencyKey`. The server caches the first response keyed against it for 5 minutes, so retries after a flaky 502 do not double-charge.
- **Cash rounding**: cash totals round to the nearest 5c (the AU convention since the 1c and 2c coin withdrawal). Card totals are exact.
- **Tax invoices**: every receipt carries business name, ABN, address, ex-GST subtotal, GST 10%, total inc GST, and any cash adjustment.
- **PIN hashing**: staff PINs are stored as `scrypt$salt$hash` strings. Verification uses `timingSafeEqual`.
- **Postgres write-through**: when `DATABASE_URL` is set, orders, audit entries, and shifts journal asynchronously to Postgres after the in-memory write. The in-memory store remains the read source; Postgres is the durable log.
- **RSA refusal log**: staff can log a refusal of service (`/pos`'s "RSA refuse" button) per Liquor Licensing Act 1997 (SA) audit requirements. Visible at `/admin/refusals`.
- **Closing bell**: 5 minutes before `tradingClose`, the engine auto-fires a 20% / 4 minute "last call" crash. Re-arms each day.
- **Margin floor**: enforced server-side per drink (`costPrice * (1 + minMarginMultiplier)`, default 30% margin above cost). Logged in `/admin/audit` and surfaced on the dashboard.

## Realtime events

`price.tick`, `price.update`, `crash.started`, `crash.tick`, `crash.ended`,
`order.placed`, `drink.updated`, `settings.updated`. Clients fetch
`/api/state/snapshot` first, subscribe to `/api/events` (SSE), and refetch
on 30 seconds of silence.

For multi-instance deploys, swap the in-process EventEmitter for Pusher
Channels or Supabase Realtime; the event shapes match.

## Operator docs

- `docs/OPERATOR_MANUAL.md` - daily open / run / close runbook
- `docs/STAFF_CHEAT_SHEET.md` - one-page POS reference
- `docs/DR_RUNBOOK.md` - disaster recovery
- `docs/CRON.md` - scheduled jobs
- `docs/screenshots/README.md` - UI gallery
- `BACKLOG.md` - everything not yet built
