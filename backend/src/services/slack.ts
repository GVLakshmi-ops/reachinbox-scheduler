import { getSlackWebhookForUser } from "../db/pool";

/**
 * Fires a real Slack message when a sender's hourly limit is hit.
 * If the user hasn't connected Slack yet, this silently no-ops (no crash).
 * Once they connect, this starts working immediately - no redeploy needed,
 * because we look the webhook up fresh from the DB every call.
 */
export async function notifyRateLimitHit(userId: number | null, sender: string, limit: number) {
  if (!userId) return;

  const webhookUrl = await getSlackWebhookForUser(userId);
  if (!webhookUrl) return; // not connected - fine, just skip

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `:warning: Hourly send limit reached for sender *${sender}* (limit: ${limit}/hour). Remaining emails have been rescheduled into the next hour window.`,
      }),
    });
  } catch (err) {
    // Slack being down shouldn't break email sending.
    console.error("Failed to send Slack notification:", err);
  }
}
