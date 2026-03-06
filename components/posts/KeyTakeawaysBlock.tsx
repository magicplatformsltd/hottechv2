"use client";

import type { KeyTakeawaysData } from "@/lib/types/post";

type KeyTakeawaysBlockProps = {
  data: KeyTakeawaysData;
};

export function KeyTakeawaysBlock({ data }: KeyTakeawaysBlockProps) {
  const items = (data.items ?? []).filter((i): i is string => typeof i === "string" && i.trim() !== "");
  if (items.length === 0) return null;

  return (
    <div className="my-6 rounded-lg border-l-4 border-hot-white/30 bg-gradient-to-br from-hot-gray/50 to-hot-gray/20 px-6 py-5">
      <h4 className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-widest text-gray-400">
        Key Takeaways
      </h4>
      <ul className="list-disc space-y-1.5 pl-5 font-sans text-base font-normal leading-normal text-hot-white/90 marker:text-hot-white/70">
        {items.map((item, index) => (
          <li key={index} className="font-normal leading-normal">{item.trim()}</li>
        ))}
      </ul>
    </div>
  );
}
