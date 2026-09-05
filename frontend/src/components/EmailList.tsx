import { Star } from "lucide-react";
import { EmailRecord } from "@/types";

interface EmailListProps {
  emails: EmailRecord[];
  loading: boolean;
  emptyMessage: string;
  mode: "scheduled" | "sent";
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { weekday: "short" }) +
        " " +
        d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function bodyPreview(html: string) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 60 ? text.slice(0, 60) + "…" : text;
}

export function EmailList({ emails, loading, emptyMessage, mode }: EmailListProps) {
  if (loading) {
    return <div className="px-6 py-12 text-center text-sm text-slate-400">Loading…</div>;
  }

  if (emails.length === 0) {
    return <div className="px-6 py-12 text-center text-sm text-slate-400">{emptyMessage}</div>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {emails.map((email) => (
        <div key={email.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50">
          <div className="w-40 shrink-0 truncate text-sm font-medium text-slate-800">
            To: {email.recipient}
          </div>

          {mode === "scheduled" ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-600">
              {formatTime(email.scheduled_at)}
            </span>
          ) : (
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                email.status === "failed" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
              }`}
            >
              {email.status === "failed" ? "Failed" : "Sent"}
            </span>
          )}

          <div className="min-w-0 flex-1 truncate text-sm text-slate-600">
            <span className="font-medium text-slate-800">{email.subject}</span>
            <span className="text-slate-400"> - {bodyPreview(email.body)}</span>
          </div>

          <button className="shrink-0 text-slate-300 hover:text-amber-400">
            <Star size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
