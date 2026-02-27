"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { forceRefreshHomepage } from "@/app/(admin)/admin/actions";

export function ClearCacheButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const result = await forceRefreshHomepage();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error("Failed to clear cache");
      }
    } catch {
      toast.error("Failed to clear cache");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 px-3 py-2 font-sans text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-hot-white disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RotateCcw className={`h-4 w-4 shrink-0 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Refreshing..." : "Force Refresh Homepage"}
    </button>
  );
}
