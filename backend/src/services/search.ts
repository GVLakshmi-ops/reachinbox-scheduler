import { Client } from "@elastic/elasticsearch";
import { env } from "../config/env";
import type { EmailRow } from "../db/pool";

export const esClient = new Client({ node: env.elasticsearchUrl });

const INDEX = "emails";

export async function ensureIndex() {
  const exists = await esClient.indices.exists({ index: INDEX });
  if (!exists) {
    await esClient.indices.create({
      index: INDEX,
      mappings: {
        properties: {
          id: { type: "keyword" },
          sender: { type: "keyword" },
          recipient: { type: "text" },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduled_at: { type: "date" },
          sent_at: { type: "date" },
        },
      },
    });
  }
}

export async function indexEmail(email: EmailRow) {
  try {
    await esClient.index({
      index: INDEX,
      id: email.id,
      document: {
        id: email.id,
        sender: email.sender,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduled_at: email.scheduled_at,
        sent_at: email.sent_at,
      },
    });
  } catch (err) {
    // Search indexing is a nice-to-have next to the source-of-truth Postgres row -
    // don't let ES being down break scheduling or sending.
    console.error("Elasticsearch indexing failed:", err);
  }
}

export async function searchEmails(query: string) {
  const result = await esClient.search({
    index: INDEX,
    query: {
      multi_match: {
        query,
        fields: ["recipient", "subject", "body", "sender"],
      },
    },
  });
  return result.hits.hits.map((h) => h._source);
}
