"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function PostsSearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(initialQuery);

  // Sync local state when URL changes (e.g. back/forward, initial load with ?q=...)
  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    const params = new URLSearchParams(searchParams.toString());
    // Reset: if empty or whitespace, remove q entirely to show all posts
    if (!trimmed) {
      params.delete("q");
    } else {
      params.set("q", trimmed);
    }
    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    router.push(url);
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        placeholder="Search posts..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-md border border-white/10 bg-white/5 py-2 pl-9 pr-10 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/30 focus:outline-none focus:ring-1 focus:ring-hot-white/30"
        aria-label="Search posts"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 transition-colors hover:text-hot-white"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}
