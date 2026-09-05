import dotenv from "dotenv";
dotenv.config();

function required(name: string, fallback?: string): string {
  const val = process.env[name] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return val;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  sessionSecret: required("SESSION_SECRET", "dev-secret"),
  frontendUrl: required("FRONTEND_URL", "http://localhost:3000"),

  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  elasticsearchUrl: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",

  etherealUser: process.env.ETHEREAL_USER ?? "",
  etherealPass: process.env.ETHEREAL_PASS ?? "",

  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:4000/auth/google/callback",

  slackClientId: process.env.SLACK_CLIENT_ID ?? "",
  slackClientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
  slackRedirectUri: process.env.SLACK_REDIRECT_URI ?? "http://localhost:4000/auth/slack/callback",

  // Scheduler tuning - all configurable, nothing hardcoded
  workerConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  minDelayMsBetweenSends: Number(process.env.MIN_DELAY_MS_BETWEEN_SENDS ?? 2000),
  maxEmailsPerHour: Number(process.env.MAX_EMAILS_PER_HOUR ?? 200),
};
