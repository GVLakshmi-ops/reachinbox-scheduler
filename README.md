# ReachInbox Scheduler

A full-stack email job scheduler + dashboard, built for the ReachInbox.ai
(Outbox Labs) Software Development Intern hiring assignment. Backend in
TypeScript/Express/BullMQ/Redis/Postgres/Elasticsearch, frontend in
Next.js/TypeScript/Tailwind, styled to match the provided Figma.

**Hosted link:** _[add your live URL here once deployed]_
**Demo video:** _[add your video link here]_

---

## Table of contents

- [Architecture overview](#architecture-overview)
- [Features implemented](#features-implemented)
- [Running it locally](#running-it-locally)
- [Deploying it (hosted link)](#deploying-it-hosted-link)
- [Assumptions, trade-offs, and shortcuts](#assumptions-trade-offs-and-shortcuts)

---

## Architecture overview

```
                     ┌──────────────┐
   Next.js UI  ─────▶│  Express API │──────▶ PostgreSQL (source of truth)
 (login, dash,       │              │
  compose, search)   │  /auth/*     │──────▶ Redis (BullMQ + rate limiting)
                     │  /api/emails │
                     └──────┬───────┘──────▶ Elasticsearch (search index)
                            │
                            ▼
                    BullMQ delayed jobs
                            │
                            ▼
                  ┌──────────────────┐
                  │  Worker process   │──────▶ Ethereal SMTP (send)
                  │ (separate from    │──────▶ Slack webhook (rate-limit alert)
                  │  the API process) │
                  └──────────────────┘
```

### Scheduling (no cron)

Every recipient in a Compose request becomes its own row in the `emails`
Postgres table **and** its own BullMQ **delayed job**
(`delay = scheduledAt - now`), with the job's `jobId` set to that row's
UUID. There is no cron job, no OS-level scheduler, and no polling loop —
BullMQ/Redis wakes the worker exactly when each job's delay elapses. See
`backend/src/queue/emailQueue.ts`.

### Restart persistence

Postgres is the single source of truth for "should this email still go
out." On boot, `reconcilePendingEmails()` (`backend/src/services/reconcile.ts`)
scans for `status = 'pending'` rows and re-adds any that don't already have
a live BullMQ job. This means a wiped/restarted Redis, or a crashed and
restarted server, can never silently drop a scheduled send. Because each
job's `jobId` equals the row's id, re-adding an already-queued job is a
no-op rather than a duplicate.

### Idempotency

The worker's first step when processing any job is to re-fetch the
Postgres row and bail out immediately if it isn't still `pending`
(`backend/src/queue/worker.ts`). This single guard covers BullMQ's
at-least-once delivery, automatic retries, and the restart-reconciliation
path above — the same email can never be sent twice.

### Concurrency

The worker runs with a configurable `concurrency`
(`WORKER_CONCURRENCY` env var), so multiple jobs are processed in parallel
by design.

### True minimum delay between sends

A naive `await sleep(delayMs)` inside a job processor looks correct but
silently breaks under concurrency: if several jobs for the same sender
start within the same tick, they all sleep in parallel and then send at
nearly the same instant — the delay never actually separates them.

Instead, `waitForSendSlot()` (`backend/src/services/rateLimiter.ts`)
reserves a send "slot" per sender via a single atomic Redis Lua script:
it reads the sender's next-available-slot timestamp, advances it by
`delayMs`, and writes it back — all in one round trip, so there's no race
condition even across multiple worker processes. The caller then sleeps
until its assigned slot arrives before sending. This guarantees a true
minimum gap between sends for a given sender, regardless of concurrency
level or how many worker processes are running. Configurable globally
(`MIN_DELAY_MS_BETWEEN_SENDS`) or per-batch (the Compose form's "Delay
between 2 emails" field, stored per-row and read by the worker).

### Hourly rate limiting

`tryConsumeRateLimit()` does an atomic Redis `INCR` on a key scoped to
`sender + current UTC hour window`, then compares against the limit. This
is safe across multiple worker processes because the counter lives in
Redis, not in memory. Configurable globally (`MAX_EMAILS_PER_HOUR`) or
per-batch (Compose form's "Hourly Limit" field).

When the limit is hit, the job is **not** failed or dropped — it's
re-enqueued with a delay that lands it in the next UTC hour window. Its
BullMQ `priority` is set to its *original* scheduled time (in ms), so an
email that gets pushed later by the rate limiter still comes out ahead of
emails that were always meant to send after it — preserving order as much
as possible.

### Slack notifications, connect/disconnect

The dashboard sidebar shows live Slack connection status (`GET
/auth/slack/status`) and lets the user disconnect (`POST
/auth/slack/disconnect`). Connecting goes through a real Slack OAuth
`incoming-webhook` flow; the resulting webhook URL is stored per user in
Postgres. `notifyRateLimitHit()` looks up that webhook fresh from the
database on every rate-limit hit — so disconnecting stops notifications
immediately, and reconnecting resumes them, with no redeploy and no
in-memory state to go stale.

### Search

Every email is indexed into Elasticsearch on creation and after each send
attempt (`backend/src/services/search.ts`). `/api/emails/search?q=...`
does a multi-match query across recipient, subject, body, and sender.
Indexing failures are logged and swallowed rather than retried — Postgres
remains the source of truth even if Elasticsearch is temporarily down.

### Live queue visibility

`@bull-board` is mounted at `/admin/queues`, giving real-time visibility
into pending, active, completed, and failed jobs without needing to query
Redis directly.

---

## Features implemented

| Area | Feature | Status |
|---|---|---|
| Backend | TypeScript + Express + BullMQ + Redis + Postgres | ✅ |
| Backend | BullMQ delayed jobs, zero cron anywhere | ✅ |
| Backend | Restart persistence / reconciliation on boot | ✅ |
| Backend | Idempotency (jobId = row id + status guard) | ✅ |
| Backend | Configurable worker concurrency | ✅ |
| Backend | True minimum delay between sends (concurrency-safe, Redis slot reservation) | ✅ |
| Backend | Hourly rate limit, Redis-backed, multi-worker safe | ✅ |
| Backend | Reschedule (not drop) on limit hit, order preserved via priority | ✅ |
| Backend | Slack OAuth + live notification on rate-limit hit | ✅ |
| Backend | Slack status + disconnect endpoints | ✅ |
| Backend | Multiple senders supported | ✅ |
| Backend | Elasticsearch indexing + search endpoint | ✅ |
| Backend | Live BullMQ dashboard (`/admin/queues`) | ✅ |
| Backend | Real Google OAuth login | ✅ |
| Backend | Load-test script for 1000+ emails | ✅ |
| Frontend | Login screen matching Figma (Google OAuth wired; email/password fields visual-only) | ✅ |
| Frontend | Dashboard sidebar: avatar/name/email, Scheduled/Sent counts, Logout | ✅ |
| Frontend | Connect/Disconnect Slack from the dashboard | ✅ |
| Frontend | Top search bar wired to Elasticsearch | ✅ |
| Frontend | Scheduled/Sent list views, loading + empty states | ✅ |
| Frontend | Compose screen: chip-based recipients, CSV/TXT upload | ✅ |
| Frontend | "✓ N email addresses detected" after upload | ✅ |
| Frontend | Delay / Hourly Limit fields (wired to backend overrides) | ✅ |
| Frontend | Working rich-text toolbar (bold/italic/underline/lists/etc.) | ✅ |
| Frontend | Send / Send Later toggle with quick-pick + custom date/time | ✅ |
| Frontend | Toast notifications for errors/success | ✅ |
| Frontend | Reusable components, typed API client, TS interfaces throughout | ✅ |
| Frontend | Figma-matched styling | ✅ |

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
cp .env.example .env   # fill in Google/Slack/Ethereal credentials, see below
npm install
npm run dev            # starts the API on :4000
```

In a **second terminal**, start the worker (a separate process, as a real
queue consumer would be):

```bash
cd backend
npm run worker
```

**Getting credentials:**
- **Ethereal SMTP** (fake SMTP for testing): create a free test account at
  https://ethereal.email/create, paste the user/pass into `.env` as
  `ETHEREAL_USER` / `ETHEREAL_PASS`.
- **Google OAuth**: create credentials at
  https://console.cloud.google.com/apis/credentials, set the authorized
  redirect URI to `http://localhost:4000/auth/google/callback`.
- **Slack OAuth**: create an app at https://api.slack.com/apps with the
  `incoming-webhook` scope, redirect URI
  `http://localhost:4000/auth/slack/callback`.

**Scheduler tuning** (all configurable via `.env`, nothing hardcoded):
`WORKER_CONCURRENCY`, `MIN_DELAY_MS_BETWEEN_SENDS`, `MAX_EMAILS_PER_HOUR`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev             # starts on :3000
```

Visit `http://localhost:3000`.

### 4. Load test (optional)

Demonstrates the "1000+ emails scheduled at once" requirement without
actually sending 1000 real emails:

```bash
cd backend
npx ts-node scripts/load-test.ts
```

Watch `http://localhost:4000/admin/queues` fill up and drain according to
your configured rate limit and delay.

---

## Deploying it (hosted link)

This was deployed on [Render](https://render.com) as three services in one
project, all pointed at the same GitHub repo:

| Service | Type | Root Directory | Build Command | Start Command |
|---|---|---|---|---|
| Frontend | Web Service | `frontend` | `npm install && npm run build` | `npm run start -- -p $PORT` |
| Backend API | Web Service | `backend` | `npm install && npm run build` | `npm start` |
| Worker | Background Worker | `backend` | `npm install && npm run build` | `npm run start:worker` |

Plus managed Postgres and Redis (Render's own, or an external provider like
Neon/Upstash — either works, just set `DATABASE_URL` / `REDIS_URL`
accordingly).

**Production-specific notes:**
- The backend's session cookie switches to `secure: true, sameSite: "none"`
  when `NODE_ENV=production`, since the frontend and backend live on
  different domains in this deployment — see `backend/src/index.ts` and
  `backend/src/config/env.ts`.
- `app.set("trust proxy", 1)` is required for secure cookies to work behind
  Render's load balancer.
- Update `GOOGLE_CALLBACK_URL` and `SLACK_REDIRECT_URI` to the deployed
  backend's real HTTPS URL, and add those exact URLs as authorized
  redirect URIs in the Google Cloud Console and the Slack app's OAuth
  settings — both providers reject callbacks from URLs they don't
  recognize.
- Set the frontend's `NEXT_PUBLIC_API_URL` to the deployed backend's URL.
- Free-tier instances spin down after inactivity; the first request after
  idling can take 30-60 seconds to respond.
- Elasticsearch is not hosted for the live link (see trade-offs below) —
  search is demonstrated working locally in the demo video instead.

---

## Assumptions, trade-offs, and shortcuts

- **Elasticsearch isn't hosted for the live deployed link.** It's the
  heaviest piece of this stack to self-host for free, and the assignment's
  core grading criteria (scheduling, persistence, rate limiting,
  concurrency) don't depend on it. The code handles its absence
  gracefully — `/api/emails/search` returns a clean "unavailable" response
  instead of crashing, and indexing failures are logged and swallowed
  rather than blocking scheduling or sending. Search is demonstrated
  working against a local Elasticsearch instance in the demo video.
- CSV/TXT parsing is a simple regex-based email extractor, not a full CSV
  parser library — correct for a plain leads list, but doesn't handle
  quoted fields containing commas.
- "Preserving order" under rate limiting is best-effort (via BullMQ job
  priority tied to original scheduled time), not a strict cross-worker
  guarantee.
- No refresh-token handling for sessions beyond `express-session`'s
  default store — fine for this deployment's scale, would need a
  persistent session store (e.g. Redis-backed) for production traffic.
- The login screen's email/password fields and the Compose screen's
  paperclip attachment button are visual-only, matching the Figma but not
  wired to the backend — the assignment requires real Google OAuth for
  login (implemented) and doesn't require attaching files to sent emails.
- `next@14.2.35` has some open `npm audit` advisories that are only fixed
  by a major-version jump to Next 16, which wasn't tested against this
  codebase given the assignment deadline — worth revisiting for any real
  production use.
