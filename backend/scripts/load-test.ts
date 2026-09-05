/**
 * Demonstrates the "1000+ emails scheduled for the same time" requirement
 * without actually sending 1000 real emails through Ethereal.
 *
 * Usage:
 *   cd backend
 *   npx ts-node scripts/load-test.ts
 *
 * This inserts 1000 rows scheduled ~10 seconds from now, across a handful
 * of senders, and lets the normal worker pick them up. Watch:
 *   - the BullMQ dashboard (http://localhost:4000/admin/queues) fill up
 *   - console logs from the worker showing rate-limit reschedules once a
 *     sender crosses its MAX_EMAILS_PER_HOUR
 *   - the `emails` table: `SELECT status, count(*) FROM emails GROUP BY status;`
 */
import { v4 as uuid } from "uuid";
import { insertEmail } from "../src/db/pool";
import { enqueueEmailJob } from "../src/queue/emailQueue";

const TOTAL = 1000;
const SENDERS = ["alice", "bob", "carol"];

async function main() {
  const startTime = new Date(Date.now() + 10_000); // 10s from now

  console.log(`Scheduling ${TOTAL} emails across ${SENDERS.length} senders...`);

  for (let i = 0; i < TOTAL; i++) {
    const id = uuid();
    const sender = SENDERS[i % SENDERS.length];
    const row = await insertEmail({
      id,
      userId: null,
      sender,
      recipient: `load-test-${i}@example.com`,
      subject: `Load test email #${i}`,
      body: `<p>This is load test email number ${i}.</p>`,
      scheduledAt: startTime,
    });
    await enqueueEmailJob(id, startTime, row.scheduled_at.getTime());

    if (i % 100 === 0) console.log(`  ...${i} enqueued`);
  }

  console.log("Done. Start the worker (npm run worker) if it isn't already running.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
