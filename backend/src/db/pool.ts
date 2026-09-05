import { Pool } from "pg";
import { env } from "../config/env";

export const pool = new Pool({ connectionString: env.databaseUrl });

export type EmailRow = {
  id: string;
  user_id: number | null;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduled_at: Date;
  priority_ms: string; // BIGINT comes back as string from pg
  delay_ms: number | null;
  hourly_limit: number | null;
  status: "pending" | "sent" | "failed";
  sent_at: Date | null;
  error: string | null;
  created_at: Date;
};

export async function insertEmail(row: {
  id: string;
  userId: number | null;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  delayMs?: number | null;
  hourlyLimit?: number | null;
}): Promise<EmailRow> {
  const { rows } = await pool.query<EmailRow>(
    `INSERT INTO emails (id, user_id, sender, recipient, subject, body, scheduled_at, priority_ms, delay_ms, hourly_limit, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
     RETURNING *`,
    [
      row.id,
      row.userId,
      row.sender,
      row.recipient,
      row.subject,
      row.body,
      row.scheduledAt,
      row.scheduledAt.getTime(),
      row.delayMs ?? null,
      row.hourlyLimit ?? null,
    ]
  );
  return rows[0];
}

export async function markEmailSent(id: string): Promise<void> {
  await pool.query(
    `UPDATE emails SET status = 'sent', sent_at = now(), error = NULL WHERE id = $1`,
    [id]
  );
}

export async function markEmailFailed(id: string, error: string): Promise<void> {
  await pool.query(`UPDATE emails SET status = 'failed', error = $2 WHERE id = $1`, [id, error]);
}

export async function getScheduledEmails(): Promise<EmailRow[]> {
  const { rows } = await pool.query<EmailRow>(
    `SELECT * FROM emails WHERE status = 'pending' ORDER BY scheduled_at ASC`
  );
  return rows;
}

export async function getSentEmails(): Promise<EmailRow[]> {
  const { rows } = await pool.query<EmailRow>(
    `SELECT * FROM emails WHERE status IN ('sent', 'failed') ORDER BY sent_at DESC NULLS LAST`
  );
  return rows;
}

export async function getPendingEmailsPastOrUpcoming(): Promise<EmailRow[]> {
  // Used on server boot to reconcile: every 'pending' row should have a live BullMQ job.
  const { rows } = await pool.query<EmailRow>(
    `SELECT * FROM emails WHERE status = 'pending'`
  );
  return rows;
}

export async function getSlackWebhookForUser(userId: number): Promise<string | null> {
  const { rows } = await pool.query<{ webhook_url: string }>(
    `SELECT webhook_url FROM slack_connections WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0]?.webhook_url ?? null;
}
