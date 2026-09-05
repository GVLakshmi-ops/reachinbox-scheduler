import { Queue } from "bullmq";
import { redisConnection } from "./connection";

export const EMAIL_QUEUE_NAME = "email-send";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 1000,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

/**
 * Enqueue an email as a BullMQ *delayed* job (no cron anywhere).
 * jobId === email.id, so re-scheduling the same email id is a no-op (idempotent),
 * and re-running this on server boot for existing rows won't create duplicates.
 *
 * `priority` preserves relative send order: pass the email's *original*
 * scheduled_at (ms since epoch, truncated) so that when a job gets pushed
 * into a later hour window by the rate limiter, it still comes out ahead of
 * emails that were originally scheduled after it. BullMQ priority is
 * ascending (1 = highest), so we mod it into BullMQ's supported range while
 * preserving relative ordering within any realistic batch size.
 */
export async function enqueueEmailJob(emailId: string, scheduledAt: Date, originalPriorityMs?: number) {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  const priority = originalPriorityMs
    ? Math.max(1, originalPriorityMs % 2_000_000)
    : undefined;

  await emailQueue.add(
    "send-email",
    { emailId },
    {
      jobId: emailId,
      delay,
      ...(priority ? { priority } : {}),
    }
  );
}
