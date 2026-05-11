# The Drink Exchange

Live pricing, point-of-sale, and customer-display system for a market-driven cocktail bar.
Prices float in real time like a stock exchange; the operator can trigger "market crashes"
that discount every dynamic drink for a short window.

> Build status: Phase 1 (The Ticker) and Phase 2 (Manual Crashes) shipped end-to-end.
> POS, Admin, and Dashboard skeletons from Phases 3-4 are functional but auth and the
> payments adapter are stubbed for development.

## Quick start

```bash
npm install
npm run dev
```

Then open:

- `/` - landing with links to every client
- `/display?profile=main` - the main customer display (full grid + ticker)
- `/display?profile=tape` - scrolling tape only, for narrow screens
- `/display?profile=featured` - three featured drinks at maximum size, rotates every 30s
- `/pos` - staff POS (dev PIN: `1234`)
- `/admin` - admin overview
- `/admin/crash` - crash centre
- `/admin/menu` - menu CRUD (activate, override price)
- `/admin/market` - volatility, decay, noise, margin floor, cooldown, trading hours
- `/admin/audit` - audit log
- `/dashboard` - live analytics

## Architecture

```
+---------------------------+
|   Next.js 15 (App Router) |
|   - API routes            |
|   - SSE at /api/events    |
|   - Tick engine (2s)      |
|   - In-memory store       |
+---------------------------+
            |
            v
  Display, POS, Admin, Dashboard
```

Realtime uses Server-Sent Events (no third-party Pusher account required for dev).
For production, swap `lib/store.ts` event emitter for a Pusher / Supabase Realtime
publisher with the same event shape.

### Pricing engine

Defined in `src/lib/engine/`. Every 2 seconds:

```
drift   = (basePrice - currentPrice) * decayRate          // 0.04 default
noise   = (random in [-1, +1]) * basePrice * noiseLevel   // 0.004 default
newPrice = clamp(currentPrice + drift + noise, min, max)
```

Each order line bumps the drink multiplicatively:

```
impact   = (1 + volatility) ^ quantity                    // 0.05 default
newPrice = min(currentPrice * impact, basePrice * maxMul)
```

Crashes do not modify `currentPrice`; the displayed and charged price is
`currentPrice * (1 - discountPercent)`, clamped at the margin floor
`costPrice * (1 + minMarginMultiplier)` (default 30%).

## Database

The in-memory store is fine for development. For Railway production:

1. Provision Postgres.
2. Set `DATABASE_URL`.
3. `npm run db:generate` then `npm run db:migrate`.
4. Wire `src/lib/store.ts` to write through to `src/lib/db/index.ts` (Drizzle schema
   already mirrors the brief: drinks, price_history, crash_events, orders, order_lines,
   shifts, users, settings, audit_log).

All currency columns are `numeric(10, 2)`. No floats.

## Realtime events

| Event             | Payload                                             |
|-------------------|-----------------------------------------------------|
| `price.tick`      | `{drinkId, currentPrice, ts}[]` from the scheduler  |
| `price.update`    | Same shape, fired after order impact                |
| `crash.started`   | `CrashEvent`                                        |
| `crash.tick`      | `{remainingSeconds}` every 1s while a crash runs    |
| `crash.ended`     | `{crashEventId, cancelledEarly}`                    |
| `order.placed`    | Sanitised order summary                             |
| `drink.updated`   | Whole drink record                                  |
| `settings.updated`| Settings object                                     |

Clients fetch `/api/state/snapshot` on connect, then subscribe to `/api/events`
incrementally. On 30s of silence the client refetches the snapshot.

## Non-negotiables honoured

- No floats for money on the API (rounds to cents); Postgres columns are `numeric(10,2)`.
- Snapshot-then-subscribe pattern in `useLiveState`.
- Crash margin floor enforced server-side in `effectiveDisplayPrice`.
- Trading-hours hard-stop on the tick engine and order placement.
- Display shows "OFFLINE" without crashing if the SSE stream drops.
- 2-second tick rate is set as a constant in `settings.tickIntervalMs`.
- No em dashes in UI or comments.

## What is intentionally stubbed

- Stripe Terminal / Square adapters (POS "Charge" finalises locally).
- Better Auth / Clerk (POS uses a dev PIN; admin is unauthenticated for local dev).
- Twilio / Postmark receipts.
- Inngest / BullMQ schedules (Z-report, daily summary, scheduled crashes).
- Sentry, Axiom, backups.

See `BACKLOG.md` for everything pending.
