"use client";

import { Clock, Send, ChevronDown, LogOut } from "lucide-react";
import { User } from "@/types";

type Tab = "scheduled" | "sent";

interface SidebarProps {
  user: User | null;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  scheduledCount: number;
  sentCount: number;
  onCompose: () => void;
  onLogout: () => void;
  slackConnected: boolean;
  slackTeamName?: string | null;
  onConnectSlack: () => void;
  onDisconnectSlack: () => void;
}

export function Sidebar({
  user,
  tab,
  onTabChange,
  scheduledCount,
  sentCount,
  onCompose,
  onLogout,
  slackConnected,
  slackTeamName,
  onConnectSlack,
  onDisconnectSlack,
}: SidebarProps) {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-black px-4 py-5 text-white">
      <div className="mb-6 px-1 font-mono text-2xl font-black tracking-widest">ONB</div>

      {user && (
        <div className="mb-4 flex w-full items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2.5 text-left">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt={user.name} className="h-8 w-8 rounded-full" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-neutral-700" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-neutral-400">{user.email}</p>
          </div>
          <ChevronDown size={16} className="text-neutral-400" />
        </div>
      )}

      <button
        onClick={onCompose}
        className="mb-6 rounded-full border border-brand-500 px-4 py-2 text-sm font-medium text-brand-500 transition-colors hover:bg-brand-500/10"
      >
        Compose
      </button>

      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-neutral-500">Core</p>

      <nav className="flex flex-col gap-1">
        <button
          onClick={() => onTabChange("scheduled")}
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
            tab === "scheduled" ? "bg-brand-100 text-slate-900" : "text-neutral-300 hover:bg-neutral-900"
          }`}
        >
          <span className="flex items-center gap-2">
            <Clock size={16} />
            Scheduled
          </span>
          <span className={tab === "scheduled" ? "text-slate-500" : "text-neutral-500"}>{scheduledCount}</span>
        </button>

        <button
          onClick={() => onTabChange("sent")}
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
            tab === "sent" ? "bg-brand-100 text-slate-900" : "text-neutral-300 hover:bg-neutral-900"
          }`}
        >
          <span className="flex items-center gap-2">
            <Send size={16} />
            Sent
          </span>
          <span className={tab === "sent" ? "text-slate-500" : "text-neutral-500"}>{sentCount}</span>
        </button>
      </nav>

      {/* Bottom section: Slack connection status + Logout - pinned to the
          bottom of the sidebar via mt-auto since this is the last child of
          a flex-col container. */}
      <div className="mt-auto space-y-2">
        <div className="rounded-lg bg-neutral-900 px-3 py-2.5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-500">Slack</p>
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className={`h-2 w-2 shrink-0 rounded-full ${slackConnected ? "bg-brand-500" : "bg-neutral-600"}`} />
              <span className="truncate">
                {slackConnected ? slackTeamName || "Connected" : "Not connected"}
              </span>
            </span>
            <button
              onClick={slackConnected ? onDisconnectSlack : onConnectSlack}
              className="shrink-0 text-xs font-medium text-brand-500 hover:text-brand-400"
            >
              {slackConnected ? "Disconnect" : "Connect"}
            </button>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
