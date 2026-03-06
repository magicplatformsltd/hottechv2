"use client";

import type { PullQuoteData } from "@/lib/types/post";

type PullQuoteBlockProps = {
  data: PullQuoteData;
};

export function PullQuoteBlock({ data }: PullQuoteBlockProps) {
  const { quoteText, attribution, alignment } = data;
  if (!quoteText?.trim()) return null;

  const isCenter = alignment === "full";
  const wrapperClass =
    isCenter
      ? "my-8 w-full text-center mt-0 clear-both"
      : alignment === "right"
        ? "float-right w-full md:w-[33%] ml-0 md:ml-8 mb-4 mt-0"
        : "float-left w-full md:w-[33%] mr-0 md:mr-8 mb-4 mt-0";

  const quoteClass =
    isCenter
      ? "font-serif text-2xl md:text-3xl text-hot-white/95 text-center"
      : "font-serif text-xl md:text-2xl text-hot-white/95";

  return (
    <div className={`clear-both ${wrapperClass}`}>
      <blockquote className={quoteClass}>
        &ldquo;{quoteText.trim()}&rdquo;
      </blockquote>
      {attribution?.trim() && (
        <footer className={`mt-2 font-sans text-sm text-gray-400 ${isCenter ? "text-center" : ""}`}>
          — {attribution.trim()}
        </footer>
      )}
    </div>
  );
}
