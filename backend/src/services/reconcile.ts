import { getPendingEmailsPastOrUpcoming } from "../db/pool";
import { emailQueue, enqueueEmailJob } from "../queue/emailQueue";

/**
 * Runs once on server boot. BullMQ's Redis state and our Postgres rows are
 * two sources of truth that must agree. If Redis lost a job (e.g. Redis was
 * wiped) but Postgres still shows the email as 'pending', re-arm it here.
 *
 * Because enqueueEmailJob uses the email's own id as the BullMQ jobId, this
 * is idempotent - if the job already exists in the queue, BullMQ simply
 * ignores the duplicate add instead of creating a second one.
 */
export async function reconcilePendingEmails() {
  const pending = await getPendingEmailsPastOrUpcoming();
  let rearmed = 0;

  for (const email of pending) {
    const existingJob = await emailQueue.getJob(email.id);
    if (!existingJob) {
      await enqueueEmailJob(email.id, new Date(email.scheduled_at), Number(email.priority_ms));
      rearmed++;
    }
  }

  console.log(
    `Reconciliation complete: ${pending.length} pending email(s) in DB, ${rearmed} re-armed into BullMQ.`
  );
}
