import { Worker, Job } from "bullmq";
import { redisConnection } from "./connection";
import { EMAIL_QUEUE_NAME, enqueueEmailJob } from "./emailQueue";
import { env } from "../config/env";
import { pool, markEmailSent, markEmailFailed, EmailRow } from "../db/pool";
import { sendEmail } from "../services/mailer";
import { tryConsumeRateLimit, msUntilNextHourWindow, waitForSendSlot } from "../services/rateLimiter";
import { notifyRateLimitHit } from "../services/slack";
import { indexEmail } from "../services/search";

async function getEmailById(id: string): Promise<EmailRow | null> {
  const { rows } = await pool.query<EmailRow>("SELECT * FROM emails WHERE id = $1", [id]);
  return rows[0] ?? null;
}

async function processJob(job: Job<{ emailId: string }>) {
  const { emailId } = job.data;
  const email = await getEmailById(emailId);

  // Idempotency guard: if this row is already sent (e.g. a duplicate/retried
  // job after a crash), don't send it again.
  if (!email || email.status !== "pending") {
    return;
  }

  // --- Rate limiting (Redis-backed, safe across multiple worker instances) ---
  // Uses the per-batch override from the Compose form if one was set,
  // otherwise falls back to the MAX_EMAILS_PER_HOUR env default.
  const { allowed, limit } = await tryConsumeRateLimit(email.sender, email.hourly_limit);
  if (!allowed) {
    await notifyRateLimitHit(email.user_id, email.sender, limit);
    // Don't drop the job - push it into the next hour window. Keep its
    // original priority so it still comes out before emails that were
    // always meant to be sent later, even though it's now running "late".
    const delay = msUntilNextHourWindow();
    await enqueueEmailJob(emailId, new Date(Date.now() + delay), Number(email.priority_ms));
    return;
  }

  // --- Minimum delay between individual sends (mimics provider throttling) ---
  // Per-batch override from Compose form, falling back to the env default.
  //
  // This is a TRUE minimum delay between sends *for this sender*, enforced
  // atomically via Redis (see waitForSendSlot), not a per-job sleep - a
  // per-job sleep breaks the moment concurrency > 1, because N concurrent
  // jobs would all sleep in parallel and then send at nearly the same
  // instant instead of being spaced apart.
  const delayMs = email.delay_ms ?? env.minDelayMsBetweenSends;
  await waitForSendSlot(email.sender, delayMs);

  try {
    await sendEmail({
      from: `${email.sender}@ethereal-demo.test`,
      to: email.recipient,
      subject: email.subject,
      html: email.body,
    });
    await markEmailSent(email.id);
  } catch (err: any) {
    await markEmailFailed(email.id, String(err?.message ?? err));
  }

  const updated = await getEmailById(email.id);
  if (updated) await indexEmail(updated);
}

export const emailWorker = new Worker(EMAIL_QUEUE_NAME, processJob, {
  connection: redisConnection,
  concurrency: env.workerConcurrency, // configurable via WORKER_CONCURRENCY
});

emailWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

emailWorker.on("completed", (job) => {
  console.log(`Job ${job.id} processed`);
});

console.log(
  `Email worker started (concurrency=${env.workerConcurrency}, minDelay=${env.minDelayMsBetweenSends}ms, hourlyLimit=${env.maxEmailsPerHour})`
);
