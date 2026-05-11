# Backlog

Items from the brief that this implementation does NOT yet fully implement. The full
spec is in `Drink_Exchange_Build_Brief.PDF`.

## Genuinely external (need a real account + credentials)

- Stripe Terminal real adapter implementation against the BBPOS WisePOS E hardware. Adapter scaffold lives in `src/lib/providers/payment.ts`.
- Square real adapter implementation. Scaffold in the same file.
- Twilio SMS sends. Scaffold in `src/lib/providers/receipt.ts`. Set `RECEIPT_PROVIDER=twilio` and provide credentials.
- Postmark or Resend email sends. Same file.
- Better Auth or Clerk integration. The current PIN flow is server-validated against the in-memory staff store; swap to real hashed PINs and sessions before production.
- TOTP 2FA on admin and owner accounts. Hook into whichever auth you pick.
- Sentry, Axiom (Better Stack), uptime monitoring.
- Pusher Channels or Supabase Realtime to replace SSE for multi-instance deployments.

## Persistence

- Wire write-through from the in-memory store to Postgres via the Drizzle schema in `src/lib/db/schema.ts`. The schema is ready; the writes are not yet plumbed.
- Nightly `pg_dump` to S3-compatible storage.

## Operational gaps

- Inngest or BullMQ scheduler to call `/api/dashboard/daily-summary?format=html` at 03:00 ACDT and email it via the receipt provider.
- Receipt printer adapter (Epson TM-m30 ESC/POS).
- 200-orders-in-5-minutes synthetic load test.
- Mobile-responsive polish on admin pages beyond the desktop layout.

## Phase 6 candidate (out of scope per brief section 14)

- Loyalty programme
- Multi-venue / franchise support
- Pre-order / table reservations (use Now Book It or SevenRooms)
- Inventory cost tracking and pour reconciliation
- Trading competitions, portfolios, virtual currencies
