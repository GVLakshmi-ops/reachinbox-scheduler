import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env } from "../config/env";
import { pool } from "../db/pool";

const router = Router();

// --- Google OAuth (real login, no mock) ---
passport.use(
  new GoogleStrategy(
    {
      clientID: env.googleClientId,
      clientSecret: env.googleClientSecret,
      callbackURL: env.googleCallbackUrl,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const name = profile.displayName;
        const email = profile.emails?.[0]?.value ?? "";
        const avatarUrl = profile.photos?.[0]?.value ?? "";

        const { rows } = await pool.query(
          `INSERT INTO users (google_id, name, email, avatar_url)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (google_id) DO UPDATE SET name = $2, email = $3, avatar_url = $4
           RETURNING *`,
          [googleId, name, email, avatarUrl]
        );
        done(null, rows[0]);
      } catch (err) {
        done(err as Error);
      }
    }
  )
);

passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser(async (id: number, done) => {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  done(null, rows[0] ?? null);
});

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${env.frontendUrl}/?error=auth` }),
  (_req, res) => res.redirect(`${env.frontendUrl}/dashboard`)
);

router.post("/logout", (req, res) => {
  req.logout(() => res.json({ ok: true }));
});

router.get("/me", (req, res) => {
  res.json({ user: req.user ?? null });
});

// --- Slack OAuth ("Connect Slack" button in the dashboard) ---
router.get("/slack", (req, res) => {
  const params = new URLSearchParams({
    client_id: env.slackClientId,
    scope: "incoming-webhook",
    redirect_uri: env.slackRedirectUri,
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
});

router.get("/slack/callback", async (req, res) => {
  const code = req.query.code as string;
  const userId = (req.user as any)?.id;

  if (!code || !userId) {
    return res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
  }

  try {
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.slackClientId,
        client_secret: env.slackClientSecret,
        code,
        redirect_uri: env.slackRedirectUri,
      }),
    });
    const data = await tokenRes.json();

    if (!data.ok) {
      console.error("Slack OAuth failed:", data);
      return res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
    }

    await pool.query(
      `DELETE FROM slack_connections WHERE user_id = $1`,
      [userId]
    );
    await pool.query(
      `INSERT INTO slack_connections (user_id, access_token, webhook_url, team_name)
       VALUES ($1, $2, $3, $4)`,
      [userId, data.access_token, data.incoming_webhook.url, data.team?.name ?? ""]
    );

    res.redirect(`${env.frontendUrl}/dashboard?slack=connected`);
  } catch (err) {
    console.error(err);
    res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
  }
});

// GET /auth/slack/status - lets the dashboard show Connected/Not connected
router.get("/slack/status", async (req, res) => {
  const userId = (req.user as any)?.id;
  if (!userId) return res.json({ connected: false });

  const { rows } = await pool.query(
    `SELECT team_name FROM slack_connections WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (rows.length === 0) return res.json({ connected: false });
  res.json({ connected: true, teamName: rows[0].team_name || null });
});

// POST /auth/slack/disconnect - required "disconnect/reconnect" handling:
// after this, rate-limit hits simply stop notifying (notifyRateLimitHit
// no-ops when it finds no row), and connecting again re-arms it without
// any redeploy.
router.post("/slack/disconnect", async (req, res) => {
  const userId = (req.user as any)?.id;
  if (!userId) return res.status(401).json({ error: "Not logged in" });

  await pool.query(`DELETE FROM slack_connections WHERE user_id = $1`, [userId]);
  res.json({ ok: true });
});

export default router;
