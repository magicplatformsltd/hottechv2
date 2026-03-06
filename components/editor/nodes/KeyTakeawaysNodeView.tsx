"use client";

import { useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Plus, Trash2 } from "lucide-react";
import type { KeyTakeawaysData } from "@/lib/types/post";
import { DEFAULT_KEY_TAKEAWAYS_DATA } from "@/lib/types/post";

function parseData(raw: string | undefined): KeyTakeawaysData {
  if (!raw || typeof raw !== "string") return { ...DEFAULT_KEY_TAKEAWAYS_DATA };
  try {
    const parsed = JSON.parse(raw) as Partial<KeyTakeawaysData>;
    const items = Array.isArray(parsed.items)
      ? parsed.items.filter((i): i is string => typeof i === "string")
      : [""];
    return { items: items.length > 0 ? items : [""] };
  } catch {
    return { ...DEFAULT_KEY_TAKEAWAYS_DATA };
  }
}

export function KeyTakeawaysNodeView({ node, getPos, editor }: NodeViewProps) {
  const data = parseData(node.attrs.data);
  const items = data.items ?? [""];

  const updateNode = useCallback(
    (newItems: string[]) => {
      const pos = typeof getPos === "function" ? getPos() : undefined;
      if (pos === undefined) return;
      editor.commands.setNodeSelection(pos);
      editor.commands.updateAttributes("keyTakeaways", {
        data: JSON.stringify({ items: newItems.length > 0 ? newItems : [""] }),
      });
    },
    [editor, getPos]
  );

  const setItem = useCallback(
    (index: number, value: string) => {
      const next = [...items];
      next[index] = value;
      updateNode(next);
    },
    [items, updateNode]
  );

  const addItem = useCallback(() => {
    updateNode([...items, ""]);
  }, [items, updateNode]);

  const removeItem = useCallback(
    (index: number) => {
      if (items.length <= 1) return;
      const next = items.filter((_, i) => i !== index);
      updateNode(next);
    },
    [items, updateNode]
  );

  return (
    <NodeViewWrapper className="my-6 block">
      <div className="rounded-lg border-l-4 border-hot-white/30 bg-white/5 p-8">
        <h4 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wide text-gray-400">
          Key Takeaways
        </h4>
        <ul className="list-disc space-y-2 pl-5">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2 font-sans text-sm text-hot-white/90">
              <input
                type="text"
                value={item}
                onChange={(e) => setItem(index, e.target.value)}
                placeholder="Takeaway…"
                className="min-w-0 flex-1 border-0 bg-transparent font-sans text-sm text-hot-white placeholder-gray-500 focus:ring-0"
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                disabled={items.length <= 1}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-white/10 hover:text-red-400 disabled:opacity-30"
                title="Remove"
                aria-label="Remove takeaway"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addItem}
          className="mt-3 flex items-center gap-1.5 rounded px-2 py-1 font-sans text-xs text-gray-400 transition hover:bg-white/10 hover:text-hot-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Add takeaway
        </button>
      </div>
    </NodeViewWrapper>
  );
}
