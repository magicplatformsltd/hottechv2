"use client";

import { useCallback, useState, useRef } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import type { PullQuoteData, PullQuoteAlignment } from "@/lib/types/post";
import { DEFAULT_PULL_QUOTE_DATA } from "@/lib/types/post";

function parseData(raw: string | undefined): PullQuoteData {
  if (!raw || typeof raw !== "string") return { ...DEFAULT_PULL_QUOTE_DATA };
  try {
    const parsed = JSON.parse(raw) as Partial<PullQuoteData>;
    return {
      quoteText: typeof parsed.quoteText === "string" ? parsed.quoteText : "",
      attribution: typeof parsed.attribution === "string" ? parsed.attribution : "",
      alignment:
        parsed.alignment === "left" || parsed.alignment === "right" || parsed.alignment === "full"
          ? parsed.alignment
          : "left",
    };
  } catch {
    return { ...DEFAULT_PULL_QUOTE_DATA };
  }
}

export function PullQuoteNodeView({ node, getPos, editor }: NodeViewProps) {
  const data = parseData(node.attrs.data);
  const [quoteText, setQuoteText] = useState(data.quoteText);
  const [attribution, setAttribution] = useState(data.attribution);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateNode = useCallback(
    (updates: Partial<PullQuoteData>) => {
      const pos = typeof getPos === "function" ? getPos() : undefined;
      if (pos === undefined) return;
      const merged: PullQuoteData = {
        quoteText: updates.quoteText ?? quoteText,
        attribution: updates.attribution ?? attribution,
        alignment: updates.alignment ?? data.alignment,
      };
      editor.commands.setNodeSelection(pos);
      editor.commands.updateAttributes("pullQuote", { data: JSON.stringify(merged) });
    },
    [editor, getPos, quoteText, attribution, data.alignment]
  );

  const setAlignment = useCallback(
    (alignment: PullQuoteAlignment) => updateNode({ alignment }),
    [updateNode]
  );

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsFocused(false);
    }
  }, []);

  const alignment = data.alignment;
  const isExpanded = isFocused;
  const isCenter = alignment === "full";
  const layoutClass = isExpanded
    ? "w-full text-center"
    : isCenter
      ? "w-full text-center clear-both"
      : alignment === "right"
        ? "float-right w-[33%] ml-8"
        : "float-left w-[33%] mr-8";

  const badgeBase = "rounded px-2 py-1 text-[10px] font-bold tracking-wider uppercase transition";
  const badgeActive = "bg-hot-white text-hot-black";
  const badgeInactive = "text-gray-400 hover:bg-white/10 hover:text-hot-white";

  return (
    <NodeViewWrapper className="mt-0 mb-4 block clear-both">
      <div
        ref={containerRef}
        onFocusCapture={() => setIsFocused(true)}
        onBlurCapture={handleBlur}
        className={`rounded-lg border border-white/10 bg-white/5 p-4 transition-all duration-200 ${layoutClass}`}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
          <span className="font-sans text-xs text-gray-500">Pull Quote</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setAlignment("left")}
              title="Left (33% width, float left)"
              className={alignment === "left" ? `${badgeBase} ${badgeActive}` : `${badgeBase} ${badgeInactive}`}
            >
              LEFT
            </button>
            <button
              type="button"
              onClick={() => setAlignment("full")}
              title="Center (100% width, section break)"
              className={alignment === "full" ? `${badgeBase} ${badgeActive}` : `${badgeBase} ${badgeInactive}`}
            >
              CENTER
            </button>
            <button
              type="button"
              onClick={() => setAlignment("right")}
              title="Right (33% width, float right)"
              className={alignment === "right" ? `${badgeBase} ${badgeActive}` : `${badgeBase} ${badgeInactive}`}
            >
              RIGHT
            </button>
          </div>
        </div>
        <blockquote
          className={`font-serif text-xl text-hot-white/95 ${isCenter ? "text-center" : ""}`}
        >
          <textarea
            value={quoteText}
            onChange={(e) => {
              setQuoteText(e.target.value);
              updateNode({ quoteText: e.target.value });
            }}
            placeholder="Quote text…"
            className={`w-full resize-y border-0 bg-transparent font-serif text-xl text-hot-white placeholder-gray-500 focus:ring-0 ${isCenter ? "text-center" : ""}`}
            rows={3}
          />
        </blockquote>
        <footer className={`mt-2 font-sans text-sm text-gray-400 ${isCenter ? "text-center" : ""}`}>
          <input
            type="text"
            value={attribution}
            onChange={(e) => {
              setAttribution(e.target.value);
              updateNode({ attribution: e.target.value });
            }}
            placeholder="— Attribution"
            className="w-full border-0 bg-transparent font-sans text-sm text-gray-400 placeholder-gray-500 focus:ring-0"
          />
        </footer>
      </div>
    </NodeViewWrapper>
  );
}
