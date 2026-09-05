import { redisConnection } from "../queue/connection";
import { env } from "../config/env";

/**
 * Global-per-sender hourly rate limit, backed by Redis INCR + EXPIRE.
 * Keyed by hour window (UTC) + sender, so it works correctly across
 * multiple worker processes/instances (no in-memory counters).
 */
function hourWindowKey(sender: string, date = new Date()): string {
  const iso = date.toISOString(); // e.g. 2026-09-04T13:xx:xx.xxxZ
  const hourBucket = iso.slice(0, 13); // "2026-09-04T13"
  return `ratelimit:${sender}:${hourBucket}`;
}

/**
 * Atomically increments the counter for this sender's current hour window.
 * Returns whether the send is allowed under MAX_EMAILS_PER_HOUR.
 */
export async function tryConsumeRateLimit(
  sender: string,
  limitOverride?: number | null
): Promise<{
  allowed: boolean;
  count: number;
  limit: number;
}> {
  const key = hourWindowKey(sender);
  const limit = limitOverride ?? env.maxEmailsPerHour;

  const count = await redisConnection.incr(key);
  if (count === 1) {
    // first increment in this window - set expiry so old windows clean themselves up
    await redisConnection.expire(key, 3600);
  }

  if (count > limit) {
    // Over the limit: roll back our increment since this send won't happen now.
    await redisConnection.decr(key);
    return { allowed: false, count: count - 1, limit };
  }

  return { allowed: true, count, limit };
}

/**
 * How many ms until the *next* hour window starts (UTC), used to
 * reschedule a job that got rate-limited into the next available window.
 */
export function msUntilNextHourWindow(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(now.getUTCHours() + 1);
  return next.getTime() - now.getTime();
}

/**
 * Enforces a true minimum delay *between individual sends* for a sender,
 * correctly even when the worker runs with concurrency > 1 or there are
 * multiple worker processes.
 *
 * A naive `await sleep(delayMs)` inside the job processor does NOT work
 * under concurrency: if 5 jobs for the same sender start within the same
 * tick, they all sleep in parallel and then send almost simultaneously -
 * the delay never actually separates them.
 *
 * Instead, this atomically reserves a send "slot" in Redis via a Lua
 * script (single round-trip, no race condition even across processes):
 * each call for a given sender is handed the next available slot, spaced
 * at least `delayMs` after the previous one, then the caller sleeps until
 * that slot arrives before actually sending.
 */
const RESERVE_SLOT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local delay = tonumber(ARGV[2])
local nextSlot = tonumber(redis.call('GET', key))
if (not nextSlot) or (nextSlot < now) then
  nextSlot = now
end
redis.call('SET', key, nextSlot + delay, 'PX', 3600000)
return nextSlot
`;

export async function waitForSendSlot(sender: string, delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  const key = `sendslot:${sender}`;
  const now = Date.now();
  const slot = Number(await redisConnection.eval(RESERVE_SLOT_SCRIPT, 1, key, now, delayMs));
  const waitMs = slot - Date.now();
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs));
  }
}
