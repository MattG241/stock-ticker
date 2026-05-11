# Backlog

Things from the brief that this implementation does not yet do. One-liners only;
move to a tracked issue before working on any of them.

## Phase 3 - POS

- Stripe Terminal adapter (`chargeAmount`, `refundCharge`, `getTerminalStatus`).
- Square adapter behind the same interface.
- PIN-based auth via Better Auth or Clerk; per-staff PINs hashed at rest.
- Tabs: leave order open across rounds, list open tabs on POS landing.
- Manager-PIN gate on post-charge voids and refunds.
- Digital receipts (Twilio SMS, Postmark or Resend email).
- Offline cache via IndexedDB; queue orders and replay on reconnect; conflict review screen.
- Z-report generation on shift close + email to ownership.

## Phase 4 - Admin and Dashboard

- TOTP 2FA on admin and owner accounts.
- Staff CRUD page + role assignment.
- Crash schedule (cron-like) + social webhook trigger with rate limiting.
- Per-shift max-discount cap auto-throttling.
- Cooling-off window UI hint when blocked.
- Dashboard: revenue-per-hour chart with day-ago / week-ago overlays.
- Daily summary email at 03:00 ACDT.
- Margin alerts feed (drinks at floor > 5 minutes).

## Phase 5 - Hardening

- Postgres persistence wired into `src/lib/store.ts` writes.
- Replace SSE with Pusher Channels (or Supabase Realtime) for multi-instance scale.
- Sentry + Axiom integration.
- Backups: nightly pg_dump to S3-compatible storage.
- Disaster recovery runbook.
- Receipt printer integration (Epson TM-m30 ESC/POS).
- BAS export (CSV with GST broken out).
- Operator manual + staff cheat sheet.
- Load test: 200 concurrent orders in 5 minutes.

## Brand

- Replace the placeholder crash stinger at `/public/crash.mp3` with the real 1.5s sweep.
- Add the order-ding chime for POS.
- Bebas Neue is loaded from Google Fonts; bundle locally for offline kiosk reliability.
