"use client";

import type { KeyTakeawaysData } from "@/lib/types/post";

type KeyTakeawaysBlockProps = {
  data: KeyTakeawaysData;
};

export function KeyTakeawaysBlock({ data }: KeyTakeawaysBlockProps) {
  const items = (data.items ?? []).filter((i): i is string => typeof i === "string" && i.trim() !== "");
  if (items.length === 0) return null;

  return (
    <div className="my-6 rounded-lg border-l-4 border-hot-white/30 bg-gray-500/10 p-8">
      <h4 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wide text-gray-400">
        Key Takeaways
      </h4>
      <ul className="list-disc space-y-1.5 pl-5 font-sans text-sm text-hot-white/90">
        {items.map((item, index) => (
          <li key={index}>{item.trim()}</li>
        ))}
      </ul>
    </div>
  );
}
