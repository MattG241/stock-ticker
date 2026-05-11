# The Drink Exchange

Live pricing, point-of-sale, and customer-display system for a market-driven cocktail bar.
Prices float in real time like a stock exchange; the operator can trigger "market crashes"
that discount every dynamic drink for a short window.

## Build status

| Phase | Brief | This repo |
|---|---|---|
| 1 | The Ticker | shipped |
| 2 | Manual Crashes | shipped |
| 3 | POS | shipped (Stripe Terminal adapter is a stub; in-memory order persistence) |
| 4 | Admin and Dashboard | shipped (2FA pending; Inngest scheduler pending) |
| 5 | Hardening | partial - daily summary endpoint, BAS export, operator manual, DR runbook all in; load test, Sentry, backups still TODO |

See `BACKLOG.md` for the precise list of remaining items.

## Quick start

```bash
npm install
npm run dev
```

Open:

- `/` - landing with links to every client
- `/display?profile=main|tape|featured` - customer-facing screens
- `/pos` - staff POS
- `/admin` - admin overview
- `/admin/crash` - manual + scheduled crashes, social webhook hint
- `/admin/menu` - drink CRUD
- `/admin/market` - volatility, decay, noise, margin floor, cooldown, trading hours
- `/admin/staff` - staff and PIN management
- `/admin/shifts` - open / close shift, Z-report, BAS CSV export
- `/admin/audit` - immutable action ledger
- `/dashboard` - live KPIs, top movers, revenue-per-hour chart, margin alerts

## How to test the whole system end-to-end

A 5 minute smoke test that exercises every Phase 1-4 feature.

1. **Start the server**
   ```bash
   npm install
   npm run build
   npm start
   ```
   Open `http://localhost:3000`.

2. **Display** - open `/display?profile=main` in one window. Prices should drift every 2 seconds. Sparklines fill in. Click anywhere once to enable audio for the crash stinger.

3. **POS** - open `/pos` in a second window. Sign in with PIN `1234` (staff). Tap drinks to fill the cart, type `you@example.com` into the receipt box, tap `CHARGE`. The display should visibly tick the drinks you bought.

4. **Tabs** - add a few drinks, hit "Save as tab", name it. The open tab appears at the top of the POS. Tap it to resume, add more drinks, charge.

5. **Manager void** - tap "Manager void" on the POS, paste an order id from a past toast, enter PIN `5678` (manager), enter a reason. Audit log records it.

6. **Crash** - open `/admin/crash` in a third window. Drag the discount to 30%, duration to 60s, click `TRIGGER CRASH NOW`. Confirm. The display flashes red, plays the stinger, shows the banner with countdown; the POS cart auto-discounts; the dashboard shows margin alerts if any drink hits the floor.

7. **Scheduled crash** - back on `/admin/crash`, pick a datetime ~2 minutes out, hit Schedule. Watch it fire automatically.

8. **Social webhook**
   ```bash
   curl -X POST http://localhost:3000/api/crash/webhook/dev-webhook-token
   ```
   A 25% / 2 minute crash fires. Calling again within 60 seconds returns `429 rate limited`.

9. **Shift close + Z-report** - open `/admin/shifts`. Click "Close shift". The Z-report appears with totals, GST, COGS estimate, per-drink counts. Console logs show the receipt-provider send.

10. **BAS export** - on `/admin/shifts` click "Download BAS CSV". Open the file; every order is one row, GST broken out.

11. **Daily summary** - open `/api/dashboard/daily-summary?format=html` in a browser tab. The HTML email body that goes to ownership at 03:00 ACDT.

12. **Audit** - `/admin/audit` shows every state change since boot. Crashes, voids, refunds, menu edits, settings edits, shift open/close, staff create, scheduled crash fires.

13. **Dashboard** - `/dashboard` should show revenue today, drinks sold, average order value, top movers with sparklines, revenue-per-hour bar chart, margin alerts, and a live order feed.

14. **Offline POS** - in Chrome DevTools (POS tab), set the Network throttling to "Offline". Take an order - the toast says "Queued offline". Set the network back to "Online" - the queued order auto-sends.

### Smoke test via curl

```bash
# Snapshot
curl -s http://localhost:3000/api/state/snapshot | jq '.drinks | length'

# Place an order
curl -s -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"staffId":"staff-1","paymentMethod":"card","items":[{"drinkId":"espresso-martini","quantity":3}]}'

# Start a crash
curl -s -X POST http://localhost:3000/api/crash \
  -H 'Content-Type: application/json' \
  -d '{"discountPercent":0.3,"durationSeconds":30,"triggeredBy":"admin"}'

# Listen to the realtime feed
curl -sN http://localhost:3000/api/events
```

## Architecture

Next.js 15 (App Router) with an in-process store (`src/lib/store.ts`) and a Drizzle schema
ready to wire up to Postgres (`src/lib/db/schema.ts`). Realtime is Server-Sent Events at
`/api/events`.

### Pricing engine (`src/lib/engine/`)

Tick (every 2s, dynamic drinks only):
```
drift   = (basePrice - currentPrice) * decayRate         // 0.04 default
noise   = (random in [-1, +1]) * basePrice * noiseLevel  // 0.004 default
newPrice = clamp(currentPrice + drift + noise, min, max)
```

Order impact:
```
impact   = (1 + volatility) ^ quantity                   // 0.05 default
newPrice = min(currentPrice * impact, basePrice * maxMul)
```

Crash:
```
displayPrice = max(currentPrice * (1 - discountPercent), costPrice * (1 + minMarginMultiplier))
```

Trading-hours hard-stop is checked on the tick engine and on order placement. Outside
hours, dynamic prices freeze and the display shows `MARKET CLOSED`.

### Provider adapters

`src/lib/providers/payment.ts` and `src/lib/providers/receipt.ts` are interfaces with a
`simulated` (dev) implementation and stub adapters for Stripe Terminal, Square, Twilio,
and Postmark. Set the env var (e.g. `PAYMENT_PROVIDER=stripe`) and provide credentials to
swap implementations; the order-placement code stays unchanged.

### Realtime events

`price.tick`, `price.update`, `crash.started`, `crash.tick`, `crash.ended`,
`order.placed`, `drink.updated`, `settings.updated`. All clients fetch
`/api/state/snapshot` first, subscribe to `/api/events`, and refetch snapshot after
30 seconds of silence.

## Database

In-memory in dev. For Railway production:

1. Provision Postgres, set `DATABASE_URL`.
2. `npm run db:generate && npm run db:migrate`.
3. Wire `src/lib/store.ts` writes through to `src/lib/db/index.ts` (Drizzle schema mirrors
   the brief: drinks, price_history, crash_events, orders, order_lines, shifts, users,
   settings, audit_log).

All currency columns are `numeric(10, 2)`. No floats anywhere.

## Non-negotiables honoured

- No floats for money on the API; Postgres columns are `numeric(10,2)`.
- Snapshot-then-subscribe pattern with 30 second silence detection.
- Crash margin floor enforced server-side, dynamically per drink based on cost.
- Trading-hours hard-stop on tick and orders.
- Display shows OFFLINE indicator without ever throwing.
- 2-second tick rate set as a single constant in `settings.tickIntervalMs`.
- Every state-changing action goes through `recordAudit`.
- Receipts (paid orders) are immutable - only voids and refunds, never edits.
- No em dashes in UI copy or comments.

## Operator docs

- `docs/OPERATOR_MANUAL.md` - daily open / run / close runbook
- `docs/STAFF_CHEAT_SHEET.md` - one-page POS reference for staff
- `docs/DR_RUNBOOK.md` - what to do when something is on fire
- `BACKLOG.md` - everything explicitly NOT in this build yet
