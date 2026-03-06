"use client";

import type { PullQuoteData } from "@/lib/types/post";

type PullQuoteBlockProps = {
  data: PullQuoteData;
};

export function PullQuoteBlock({ data }: PullQuoteBlockProps) {
  const { quoteText, attribution, alignment } = data;
  if (!quoteText?.trim()) return null;

  const isCenter = alignment === "full";
  const floatClass =
    isCenter
      ? "w-full text-center mb-10"
      : alignment === "right"
        ? "float-right w-full md:w-[33%] ml-0 md:ml-8 mt-0 mb-4"
        : "float-left w-full md:w-[33%] mr-0 md:mr-8 mt-0 mb-4";

  const quoteClass =
    isCenter
      ? "font-serif text-2xl md:text-3xl text-hot-white/95 text-center"
      : "font-serif text-xl md:text-2xl text-hot-white/95 leading-relaxed";

  return (
    <div className="mt-8 clear-both">
      <div className={floatClass}>
        <blockquote className={quoteClass}>
        &ldquo;{quoteText.trim()}&rdquo;
      </blockquote>
      {attribution?.trim() && (
        <footer className={`mt-2 font-sans text-sm text-gray-400 ${isCenter ? "text-center" : ""}`}>
          — {attribution.trim()}
        </footer>
      )}
      </div>
    </div>
  );
}
