"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Clock, ArrowLeft, X as XIcon } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { RecipientChips } from "@/components/RecipientChips";
import { RichToolbar } from "@/components/RichToolbar";
import { SendLaterPopover } from "@/components/SendLaterPopover";

export default function ComposePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);

  const [sender, setSender] = useState("default");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [delayMs, setDelayMs] = useState<number | "">("");
  const [hourlyLimit, setHourlyLimit] = useState<number | "">("");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [detectedInfo, setDetectedInfo] = useState<{ count: number; fileName: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Preview-only: the assignment doesn't require attaching files to the
    // actual sent email, just visual parity with the Figma compose screen.
    setAttachmentPreview(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    const body = editorRef.current?.innerHTML?.trim() ?? "";

    if (!subject || !body || recipients.length === 0) {
      showToast("Subject, body, and at least one recipient are required.");
      return;
    }

    setSubmitting(true);
    try {
      await api.scheduleEmails({
        sender,
        subject,
        body,
        recipients,
        startTime: (scheduledAt ?? new Date()).toISOString(),
        delayMs: delayMs === "" ? 0 : delayMs,
        hourlyLimit: hourlyLimit === "" ? 0 : hourlyLimit,
      });
      showToast(
        scheduledAt ? "Email scheduled for later." : "Email scheduled to send now.",
        "success"
      );
      router.push("/dashboard");
    } catch {
      showToast("Failed to schedule. Is the backend running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl border-x border-slate-100">
      <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-slate-500 hover:text-slate-800">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-medium text-slate-800">Compose New Email</h1>
        </div>

        <div className="flex items-center gap-3">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAttachmentChange} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-slate-400 hover:text-slate-600"
            title="Attach file"
          >
            <Paperclip size={18} />
          </button>

          <div className="relative">
            <button
              onClick={() => setPopoverOpen((o) => !o)}
              className={scheduledAt ? "text-brand-600" : "text-slate-400 hover:text-slate-600"}
              title="Send later"
            >
              <Clock size={18} />
            </button>
            {popoverOpen && (
              <SendLaterPopover
                onCancel={() => setPopoverOpen(false)}
                onDone={(date) => {
                  setScheduledAt(date);
                  setPopoverOpen(false);
                }}
              />
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={
              scheduledAt
                ? "rounded-full border border-brand-500 px-5 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50"
                : "rounded-full bg-brand-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            }
          >
            {submitting ? "Scheduling…" : scheduledAt ? "Send Later" : "Send"}
          </button>
        </div>
      </header>

      <div className="px-6">
        <div className="flex items-center gap-2 border-b border-slate-100 py-3">
          <span className="w-16 shrink-0 text-sm text-slate-500">From</span>
          <input
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            className="flex-1 rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <RecipientChips
          recipients={recipients}
          onChange={setRecipients}
          onError={(msg) => showToast(msg)}
          onFileParsed={(count, fileName) => setDetectedInfo({ count, fileName })}
        />

        {detectedInfo && (
          <p className="-mt-1 mb-1 pl-16 text-xs text-brand-600">
            ✓ {detectedInfo.count} email address{detectedInfo.count === 1 ? "" : "es"} detected from{" "}
            {detectedInfo.fileName}
          </p>
        )}

        <div className="flex items-center gap-2 border-b border-slate-100 py-3">
          <span className="w-16 shrink-0 text-sm text-slate-500">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-6 py-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Delay between 2 emails
            <input
              type="number"
              min={0}
              value={delayMs}
              onChange={(e) => setDelayMs(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="00"
              className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Hourly Limit
            <input
              type="number"
              min={0}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="00"
              className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
        </div>

        <RichToolbar editorRef={editorRef} />

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Type Your Reply..."
          className="min-h-[240px] py-4 text-sm text-slate-800 focus:outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
        />

        {attachmentPreview && (
          <div className="relative mb-4 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachmentPreview} alt="Attachment preview" className="h-24 w-24 rounded-lg object-cover" />
            <button
              onClick={() => setAttachmentPreview(null)}
              className="absolute -right-2 -top-2 rounded-full bg-white p-0.5 text-slate-500 shadow"
            >
              <XIcon size={14} />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
