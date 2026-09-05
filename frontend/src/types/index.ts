export type EmailStatus = "pending" | "sent" | "failed";

export interface EmailRecord {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduled_at: string;
  sent_at: string | null;
  status: EmailStatus;
  error: string | null;
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatar_url: string;
}

export interface SearchHit {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduled_at: string;
  sent_at: string | null;
}

export interface ScheduleFormValues {
  sender: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string; // ISO string
  delayMs: number;
  hourlyLimit: number;
}
