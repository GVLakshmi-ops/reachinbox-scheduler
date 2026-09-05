"use client";

import { Search, Filter, RefreshCw } from "lucide-react";

interface TopSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function TopSearchBar({ value, onChange, onSubmit, onRefresh, refreshing }: TopSearchBarProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex items-center gap-3 border-b border-slate-100 px-6 py-4"
    >
      <div className="flex flex-1 items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
        <Search size={16} className="text-slate-400" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search"
          className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
      <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600">
        <Filter size={18} />
      </button>
      <button
        type="button"
        onClick={onRefresh}
        className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      >
        <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
      </button>
    </form>
  );
}
