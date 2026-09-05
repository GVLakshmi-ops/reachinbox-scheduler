import { EmailRecord, ScheduleFormValues, User, SearchHit } from "@/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }
  return res.json();
}

export const api = {
  me: () => request<{ user: User | null }>("/auth/me"),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  getScheduled: () => request<EmailRecord[]>("/api/emails/scheduled"),
  getSent: () => request<EmailRecord[]>("/api/emails/sent"),
  search: (q: string) => request<SearchHit[]>(`/api/emails/search?q=${encodeURIComponent(q)}`),

  scheduleEmails: (values: ScheduleFormValues) =>
    request<{ scheduled: number; emails: EmailRecord[] }>("/api/emails/schedule", {
      method: "POST",
      body: JSON.stringify(values),
    }),

  parseRecipients: async (file: File): Promise<{ count: number; recipients: string[] }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/emails/parse-recipients`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to parse recipients");
    return res.json();
  },

  getSlackStatus: () => request<{ connected: boolean; teamName?: string | null }>("/auth/slack/status"),
  disconnectSlack: () => request<{ ok: true }>("/auth/slack/disconnect", { method: "POST" }),
};

export function googleLoginUrl() {
  return `${API_BASE}/auth/google`;
}

export function slackConnectUrl() {
  return `${API_BASE}/auth/slack`;
}
