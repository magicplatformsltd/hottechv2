"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function SyncButton() {
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/ingest", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        alert("Sync Failed");
        return;
      }
      alert(`Sync Complete. Added: ${data.added ?? 0}, Skipped: ${data.skipped ?? 0}`);
    } catch {
      alert("Sync Failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 px-3 py-2 font-sans text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-hot-white disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`h-4 w-4 shrink-0 ${syncing ? "animate-spin" : ""}`} />
      {syncing ? "Syncing..." : "Sync Content"}
    </button>
  );
}
