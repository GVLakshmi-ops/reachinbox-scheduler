"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, slackConnectUrl } from "@/lib/api";
import { EmailRecord, SearchHit, User } from "@/types";
import { useToast } from "@/components/Toast";
import { Sidebar } from "@/components/Sidebar";
import { TopSearchBar } from "@/components/TopSearchBar";
import { EmailList } from "@/components/EmailList";

type Tab = "scheduled" | "sent";

export default function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("scheduled");
  const [scheduled, setScheduled] = useState<EmailRecord[]>([]);
  const [sent, setSent] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[] | null>(null);
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackTeamName, setSlackTeamName] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [me, scheduledRows, sentRows] = await Promise.all([
        api.me(),
        api.getScheduled(),
        api.getSent(),
      ]);
      setUser(me.user);
      setScheduled(scheduledRows);
      setSent(sentRows);
    } catch {
      showToast("Could not reach the backend. Is it running on :4000?");
    } finally {
      setLoading(false);
    }
  }

  async function loadSlackStatus() {
    try {
      const status = await api.getSlackStatus();
      setSlackConnected(status.connected);
      setSlackTeamName(status.teamName ?? null);
    } catch {
      // non-fatal - just leave it showing "Not connected"
    }
  }

  useEffect(() => {
    loadAll();
    loadSlackStatus();

    // Coming back from the Slack OAuth callback (?slack=connected|error)
    const slackParam = searchParams.get("slack");
    if (slackParam === "connected") {
      showToast("Slack connected.", "success");
      loadSlackStatus();
    } else if (slackParam === "error") {
      showToast("Slack connection failed. Check your Slack app credentials.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const results = await api.search(searchQuery.trim());
      setSearchResults(results);
    } catch {
      showToast("Search is unavailable — is Elasticsearch running?");
      setSearchResults(null);
    }
  }

  async function handleLogout() {
    await api.logout();
    window.location.href = "/";
  }

  async function handleDisconnectSlack() {
    try {
      await api.disconnectSlack();
      setSlackConnected(false);
      setSlackTeamName(null);
      showToast("Slack disconnected.", "success");
    } catch {
      showToast("Failed to disconnect Slack.");
    }
  }

  return (
    <main className="flex h-screen bg-white">
      <Sidebar
        user={user}
        tab={tab}
        onTabChange={(t) => {
          setTab(t);
          setSearchResults(null);
        }}
        scheduledCount={scheduled.length}
        sentCount={sent.length}
        onCompose={() => router.push("/compose")}
        onLogout={handleLogout}
        slackConnected={slackConnected}
        slackTeamName={slackTeamName}
        onConnectSlack={() => (window.location.href = slackConnectUrl())}
        onDisconnectSlack={handleDisconnectSlack}
      />

      <section className="flex-1 overflow-y-auto">
        <TopSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={handleSearch}
          onRefresh={loadAll}
          refreshing={loading}
        />

        {searchResults ? (
          <EmailList
            emails={searchResults.map((r) => ({ ...r, error: null }))}
            loading={false}
            emptyMessage="No emails matched that search."
            mode={tab}
          />
        ) : tab === "scheduled" ? (
          <EmailList
            emails={scheduled}
            loading={loading}
            emptyMessage="No scheduled emails yet. Click Compose to create one."
            mode="scheduled"
          />
        ) : (
          <EmailList emails={sent} loading={loading} emptyMessage="No emails sent yet." mode="sent" />
        )}
      </section>
    </main>
  );
}
