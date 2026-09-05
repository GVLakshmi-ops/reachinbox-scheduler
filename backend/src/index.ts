import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import { env } from "./config/env";
import { emailQueue } from "./queue/emailQueue";
import { reconcilePendingEmails } from "./services/reconcile";
import { ensureIndex } from "./services/search";
import emailRoutes from "./routes/emails";
import authRoutes from "./routes/auth";

async function main() {
  const app = express();

  app.use(cors({ origin: env.frontendUrl, credentials: true }));
  app.use(express.json());
  app.use(
    session({
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  // --- Live BullMQ dashboard (required: real-time queue visibility) ---
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });
  app.use("/admin/queues", serverAdapter.getRouter());

  app.use("/auth", authRoutes);
  app.use("/api/emails", emailRoutes);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // --- Restart persistence: re-arm any pending emails BEFORE accepting new traffic ---
  await reconcilePendingEmails();

  // Elasticsearch is optional for local dev; don't crash boot if it's not running.
  ensureIndex().catch((err) => console.warn("Elasticsearch not available yet:", err.message));

  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
    console.log(`BullMQ dashboard: http://localhost:${env.port}/admin/queues`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
