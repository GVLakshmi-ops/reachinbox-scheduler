"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";

interface RecipientChipsProps {
  recipients: string[];
  onChange: (recipients: string[]) => void;
  onError: (message: string) => void;
  onFileParsed?: (detectedCount: number, fileName: string) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RecipientChips({ recipients, onChange, onError, onFileParsed }: RecipientChipsProps) {
  const [draft, setDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const visible = recipients.slice(0, 3);
  const overflow = recipients.length - visible.length;

  function commitDraft() {
    const candidate = draft.trim().replace(/,$/, "");
    if (candidate && EMAIL_RE.test(candidate) && !recipients.includes(candidate)) {
      onChange([...recipients, candidate]);
    }
    setDraft("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && draft === "" && recipients.length > 0) {
      onChange(recipients.slice(0, -1));
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // The backend explicitly returns { count, recipients } so the UI can
      // show "N email addresses detected" - the count reflects exactly
      // what was found in this file, before any merging with existing chips.
      const { count, recipients: parsed } = await api.parseRecipients(file);
      const merged = Array.from(new Set([...recipients, ...parsed]));
      onChange(merged);
      onFileParsed?.(count, file.name);
    } catch {
      onError("Could not parse that file. Try a plain CSV/TXT of email addresses.");
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-slate-100 py-3">
      <span className="w-16 shrink-0 text-sm text-slate-500">To</span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {visible.map((r) => (
          <span
            key={r}
            className="flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700"
          >
            {r}
            <button
              type="button"
              onClick={() => onChange(recipients.filter((x) => x !== r))}
              className="text-brand-500 hover:text-brand-700"
            >
              ×
            </button>
          </span>
        ))}
        {overflow > 0 && (
          <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700">
            +{overflow}
          </span>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={recipients.length === 0 ? "recipient@example.com" : ""}
          className="min-w-[160px] flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
      <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        ↑ Upload List
      </button>
    </div>
  );
}
