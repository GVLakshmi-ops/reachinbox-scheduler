import { Router } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { insertEmail, getScheduledEmails, getSentEmails } from "../db/pool";
import { enqueueEmailJob } from "../queue/emailQueue";
import { indexEmail } from "../services/search";
import { searchEmails } from "../services/search";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Pull email addresses out of an uploaded CSV/text file.
 * Very forgiving: splits on commas/newlines and keeps anything with an "@".
 */
function parseRecipientsFromBuffer(buf: Buffer): string[] {
  const text = buf.toString("utf-8");
  const candidates = text.split(/[\s,;]+/).map((s) => s.trim());
  return candidates.filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

// POST /api/emails/parse-recipients  (multipart file upload, used by the Compose modal
// to show "N email addresses detected" before scheduling)
router.post("/parse-recipients", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const recipients = parseRecipientsFromBuffer(req.file.buffer);
  res.json({ count: recipients.length, recipients });
});

// POST /api/emails/schedule
// body: { sender, subject, body, recipients: string[], startTime, delayMs?, hourlyLimit? }
router.post("/schedule", async (req, res) => {
  try {
    const { sender = "default", subject, body, recipients, startTime, delayMs, hourlyLimit } = req.body;

    if (!subject || !body || !Array.isArray(recipients) || recipients.length === 0 || !startTime) {
      return res.status(400).json({ error: "subject, body, recipients[], startTime are required" });
    }

    const userId = (req as any).user?.id ?? null;
    const start = new Date(startTime);
    const created = [];

    // Each recipient becomes its own row + its own delayed BullMQ job (id = row id),
    // so restart-safety and idempotency apply per email, not per batch.
    for (const recipient of recipients) {
      const id = uuid();
      const row = await insertEmail({
        id,
        userId,
        sender,
        recipient,
        subject,
        body,
        scheduledAt: start,
        delayMs: typeof delayMs === "number" && delayMs > 0 ? delayMs : null,
        hourlyLimit: typeof hourlyLimit === "number" && hourlyLimit > 0 ? hourlyLimit : null,
      });
      await enqueueEmailJob(id, start, start.getTime());
      await indexEmail(row);
      created.push(row);
    }

    res.status(201).json({ scheduled: created.length, emails: created });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to schedule emails" });
  }
});

router.get("/scheduled", async (_req, res) => {
  res.json(await getScheduledEmails());
});

router.get("/sent", async (_req, res) => {
  res.json(await getSentEmails());
});

router.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "");
  if (!q) return res.json([]);
  try {
    res.json(await searchEmails(q));
  } catch (err) {
    console.error("Search failed (is Elasticsearch running?):", err);
    res.status(503).json({ error: "Search is unavailable" });
  }
});

export default router;
