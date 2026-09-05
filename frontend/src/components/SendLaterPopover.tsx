"use client";

import { useState } from "react";

interface SendLaterPopoverProps {
  onCancel: () => void;
  onDone: (date: Date) => void;
}

function tomorrowAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const QUICK_OPTIONS = [
  { label: "Tomorrow", getDate: () => tomorrowAt(9, 0) },
  { label: "Tomorrow, 10:00 AM", getDate: () => tomorrowAt(10, 0) },
  { label: "Tomorrow, 11:00 AM", getDate: () => tomorrowAt(11, 0) },
  { label: "Tomorrow, 3:00 PM", getDate: () => tomorrowAt(15, 0) },
];

export function SendLaterPopover({ onCancel, onDone }: SendLaterPopoverProps) {
  const [customDateTime, setCustomDateTime] = useState("");
  const [selected, setSelected] = useState<Date | null>(null);

  return (
    <div className="absolute right-0 top-10 z-20 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Send Later</h3>

      <input
        type="datetime-local"
        value={customDateTime}
        onChange={(e) => {
          setCustomDateTime(e.target.value);
          setSelected(e.target.value ? new Date(e.target.value) : null);
        }}
        className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      <div className="mb-4 flex flex-col gap-1">
        {QUICK_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => {
              setSelected(opt.getDate());
              setCustomDateTime("");
            }}
            className="rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex justify-end gap-3 text-sm">
        <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-700">
          Cancel
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onDone(selected)}
          className="rounded-full border border-brand-500 px-4 py-1 font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-40"
        >
          Done
        </button>
      </div>
    </div>
  );
}
