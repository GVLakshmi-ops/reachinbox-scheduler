# ReachInbox Scheduler — Ready-to-Submit Build

A full-stack implementation of the email job scheduler assignment, styled to
match the provided Figma (login screen, sidebar inbox layout, list-style
Scheduled/Sent views, and the full-page Compose screen with chip-based
recipients, delay/hourly-limit fields, a rich-text toolbar, and a Send/Send
Later flow).

## What's implemented

**Backend**
- ✅ TypeScript + Express + BullMQ + Redis + Postgres
- ✅ Delayed-job scheduling (no cron anywhere)
- ✅ Ethereal SMTP sending
- ✅ Restart persistence (`src/services/reconcile.ts` re-arms any `pending` DB
  rows that are missing from BullMQ on boot)
- ✅ Idempotency (BullMQ `jobId` = email row `id`; worker checks row status
  before sending)
- ✅ Configurable worker concurrency (`WORKER_CONCURRENCY`)
- ✅ Minimum delay between sends, enforced as a true inter-send minimum via
  a Redis-backed atomic slot reservation (`waitForSendSlot` in
  `rateLimiter.ts`) — **not** a per-job `sleep()`, which breaks under
  concurrency (N concurrent jobs would all sleep in parallel and then send
  at nearly the same instant). Configurable globally
  (`MIN_DELAY_MS_BETWEEN_SENDS`) or per-batch (Compose form's "Delay
  between 2 emails" field)
- ✅ Redis-backed hourly rate limiting per sender, globally
  (`MAX_EMAILS_PER_HOUR`) or per-batch (Compose form's "Hourly Limit" field),
  safe across multiple worker processes, reschedules into the next hour
  window instead of dropping jobs
- ✅ Slack notification on rate-limit hit, via real Slack OAuth
  (`incoming-webhook` scope), with a status endpoint and a disconnect
  endpoint so the dashboard can show Connected/Not Connected and let the
  user disconnect/reconnect without a redeploy
- ✅ Elasticsearch indexing + `/api/emails/search`
- ✅ Live BullMQ dashboard at `/admin/queues` (via `@bull-board`)
- ✅ Real Google OAuth login

**Frontend (matches the Figma)**
- ✅ Login screen: Google login button, divider, email/password fields
  (email/password are visual-only — only Google OAuth is wired to the
  backend, per the assignment's "real Google OAuth, no mock" requirement)
- ✅ Black sidebar with logo, user card, pill "Compose" button,
  Scheduled/Sent nav items with live counts, a Slack connection widget
  (Connect / Connected + team name / Disconnect), and a working Logout
  button
- ✅ Top search bar (search / filter / refresh) wired to
  `/api/emails/search`
- ✅ Inbox-style list rows for Scheduled (orange time badge) and Sent
  (status badge), with subject + body preview + star icon, loading and
  empty states
- ✅ Full-page Compose screen: From/To/Subject fields, chip-based recipient
  input with CSV "Upload List", a "✓ N email addresses detected" line, and
  a "+N" chip overflow, Delay/Hourly Limit inputs, a working rich-text
  toolbar (bold/italic/underline/lists/etc. via `contentEditable` +
  `execCommand`), and a Send / Send Later toggle with a quick-pick +
  custom date/time popover
- ✅ Toast notifications for errors/success
- ✅ Typed API client, reusable components

**Order preservation under rate limiting** — jobs carry a `priority` equal
to their original scheduled time, so an email that gets pushed into a later
hour window by the rate limiter still comes out ahead of emails that were
always meant to send later (see `priority_ms` in the schema).

**Load test** — `backend/scripts/load-test.ts` schedules 1000 emails across
3 senders for ~10 seconds from now, so you can watch the rate limiter and
BullMQ dashboard handle it without actually sending 1000 real emails:
```bash
cd backend
npx ts-node scripts/load-test.ts
```

---

## Running it locally

### 1. Infra (Postgres, Redis, Elasticsearch)

```bash
docker compose up -d
```

Then create the schema once:

```bash
psql "postgres://postgres:postgres@localhost:5432/reachinbox" -f backend/schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # fill in Google/Slack/Ethereal credentials
npm install
npm run dev            # starts the API on :4000
```

In a **second terminal**, start the worker (separate process, as a real
queue consumer would be):

```bash
cd backend
npm run worker
```

- Get free Ethereal SMTP credentials at https://ethereal.email/create — paste
  them into `.env` as `ETHEREAL_USER` / `ETHEREAL_PASS`.
- Google OAuth: create credentials at https://console.cloud.google.com/apis/credentials,
  set the callback URL to `http://localhost:4000/auth/google/callback`.
- Slack OAuth: create an app at https://api.slack.com/apps with the
  `incoming-webhook` scope, redirect URI `http://localhost:4000/auth/slack/callback`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev             # starts on :3000
```

Visit `http://localhost:3000`.

---

## Architecture overview

**Scheduling.** Every recipient in a compose request becomes its own row in
the `emails` Postgres table and its own BullMQ **delayed job**
(`delay = scheduledAt - now`), with the job's `jobId` set to the row's UUID.
No cron, no polling loop — BullMQ/Redis wakes the worker exactly when the
job's delay elapses.

**Restart persistence.** Postgres is the source of truth for "should this
email still go out." On boot, `reconcilePendingEmails()` scans for
`status = 'pending'` rows and re-adds any that don't already have a live
BullMQ job — so a wiped/restarted Redis (or a crashed server) can't
silently drop a scheduled send. Because `jobId` = row id, re-adding an
already-queued job is a no-op, not a duplicate.

**Idempotency.** The worker's first step is to re-fetch the row and bail out
if it's not still `pending` — this covers BullMQ retries, at-least-once
delivery, and manual re-triggers all with the same guard.

**Rate limiting & concurrency.** The worker runs with a configurable
`concurrency`. Each send first calls `tryConsumeRateLimit(sender)`, which
does an atomic Redis `INCR` on a key scoped to `sender + current UTC hour`.
This is safe across multiple worker processes because the counter lives in
Redis, not in-memory. If the limit is exceeded, the job is **not** failed —
it's re-enqueued with a new delay that lands it in the next hour window,
and (if the user has connected Slack) a webhook notification fires.

**True inter-send delay.** A per-job `await sleep(delayMs)` inside the
worker looks right but is actually broken under concurrency: if `N` jobs
for the same sender start within the same tick, they all sleep in parallel
and then send almost simultaneously — the delay never separates them.
Instead, `waitForSendSlot()` reserves a send "slot" per sender via a single
atomic Redis Lua script (`GET` current next-slot, `MAX` with now, `SET`
next-slot += delay — all in one round-trip, so there's no race even across
multiple worker processes), then the caller sleeps until its assigned slot
arrives. This guarantees a true minimum gap between sends for a given
sender regardless of concurrency level or process count.

**Slack connect / disconnect.** The dashboard sidebar shows live status via
`GET /auth/slack/status` and lets the user disconnect via
`POST /auth/slack/disconnect`. `notifyRateLimitHit()` looks up the
webhook fresh from the DB on every rate-limit hit, so disconnecting stops
notifications immediately and reconnecting resumes them — no redeploy, no
stale in-memory state.

**Trade-offs / shortcuts taken in this build:**
- CSV parsing is a simple regex-based email extractor, not a full CSV parser
  library — fine for a leads list, but doesn't handle quoted fields with
  commas.
- "Preserving order" under rate limiting is best-effort (FIFO within a
  sender), not a strict guarantee across concurrent workers.
- Elasticsearch indexing failures are logged and swallowed rather than
  retried, so Postgres stays the source of truth even if ES is down.
- No refresh-token handling for session persistence beyond
  `express-session`'s in-memory store — fine for local dev/demo, would need
  a real session store (Redis) for production.
- The login screen's email/password fields and the compose screen's
  paperclip attachment are visual-only, matching the Figma but not wired to
  the backend — the assignment only requires real Google OAuth for login
  and doesn't require attaching files to sent emails.
- `next@14.2.35` still has some open advisories per `npm audit` (fixed only
  by a major-version jump to Next 16, which wasn't tested against this
  codebase) — fine for a local dev/demo submission, worth revisiting before
  any real deployment.

## Features implemented (mapped to the spec)

| Area | Feature | Status |
|---|---|---|
| Backend | BullMQ delayed jobs, no cron | ✅ |
| Backend | Restart persistence / reconciliation | ✅ |
| Backend | Idempotency | ✅ |
| Backend | Configurable concurrency | ✅ |
| Backend | Min delay between sends (true inter-send minimum, concurrency-safe) | ✅ |
| Backend | Hourly rate limit (Redis-backed) | ✅ |
| Backend | Reschedule (not drop) on limit hit | ✅ |
| Backend | Slack OAuth + live notification | ✅ |
| Backend | Slack status + disconnect endpoints | ✅ |
| Backend | Elasticsearch indexing + search | ✅ |
| Backend | Live BullMQ dashboard | ✅ |
| Frontend | Google OAuth login | ✅ |
| Frontend | Dashboard sidebar (avatar/name/email, counts, Logout) | ✅ |
| Frontend | Connect/Disconnect Slack from the dashboard | ✅ |
| Frontend | Compose screen (chips, CSV upload + detected-count line, delay, hourly limit, rich text, Send Later) | ✅ |
| Frontend | Scheduled/Sent list views, loading + empty states | ✅ |
| Frontend | Search bar (Elasticsearch) | ✅ |
| Frontend | Toast error handling | ✅ |
| Frontend | Figma-matched styling | ✅ |

---

## Before you submit — checklist

Things this build can't do for you:

- [ ] Get real credentials: Google OAuth client, Slack app (`incoming-webhook`
      scope), Ethereal test account — put them in `.env`
- [ ] Create a **private** GitHub repo, push this code, and grant access to
      `Mitrajit` and `Yadav036`
- [ ] Actually run the restart test locally: schedule an email a few minutes
      out, kill the backend (`Ctrl+C`), restart it, confirm the console log
      shows it re-armed the pending job, and that it still sends on time
- [ ] Run `npx ts-node scripts/load-test.ts` and capture the BullMQ dashboard
      handling it, for the "bonus" load demonstration
- [ ] Record the ≤5 min demo video (schedule → dashboard → restart test →
      rate limit/load behavior)
- [ ] Fill in the ClickUp submission form with your repo link and video
