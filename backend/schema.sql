-- Run this once against your Postgres database:
--   psql "$DATABASE_URL" -f schema.sql

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  google_id   TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- one row per connected Slack workspace/user (webhook-based, no token needed to send)
CREATE TABLE IF NOT EXISTS slack_connections (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token  TEXT NOT NULL,
  webhook_url   TEXT NOT NULL,
  team_name     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emails (
  id              UUID PRIMARY KEY, -- used as the idempotent BullMQ job id too
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sender          TEXT NOT NULL DEFAULT 'default',
  recipient       TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  -- original scheduled_at in ms, fixed at creation time; used as BullMQ job
  -- priority so rate-limit reschedules don't reorder emails relative to
  -- ones that were always meant to go out later.
  priority_ms     BIGINT NOT NULL,
  -- per-batch overrides from the Compose form; NULL falls back to the
  -- MIN_DELAY_MS_BETWEEN_SENDS / MAX_EMAILS_PER_HOUR env defaults.
  delay_ms        INTEGER,
  hourly_limit    INTEGER,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed
  sent_at         TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_scheduled_at ON emails(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender);
