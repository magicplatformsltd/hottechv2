"use client";

import React from "react";
import type {
  SponsorBlockData,
  ImageGalleryData,
  ImageComparisonData,
  PullQuoteData,
  KeyTakeawaysData,
} from "@/lib/types/post";
import { SponsorBlock } from "@/components/posts/SponsorBlock";
import { ImageGalleryBlock } from "@/components/posts/ImageGalleryBlock";
import { ImageComparisonBlock } from "@/components/posts/ImageComparisonBlock";
import { PullQuoteBlock } from "@/components/posts/PullQuoteBlock";
import { KeyTakeawaysBlock } from "@/components/posts/KeyTakeawaysBlock";

export type RenderedBlock =
  | { type: "html"; content: string }
  | { type: "sponsor"; data: SponsorBlockData }
  | { type: "imageGallery"; data: ImageGalleryData }
  | { type: "imageComparison"; data: ImageComparisonData }
  | { type: "pullQuote"; data: PullQuoteData }
  | { type: "keyTakeaways"; data: KeyTakeawaysData };

type BlockRendererProps = {
  blocks: RenderedBlock[];
  className?: string;
  /** Applied to HTML segment wrappers (e.g. "contents" for prose flow) */
  blockClassName?: string;
};

/** Ensures h2, h3, figure after a pull quote clear the float. */
const PULL_QUOTE_CLEAR_STYLE = `
  .segment-after-pull-quote h2,
  .segment-after-pull-quote h3,
  .segment-after-pull-quote figure {
    clear: both;
  }
`;

function wrapAfterPullQuote(blockIndex: number, blocks: RenderedBlock[], content: React.ReactNode) {
  const prevIsPullQuote = blockIndex > 0 && blocks[blockIndex - 1].type === "pullQuote";
  if (!prevIsPullQuote) return content;
  return <div className="segment-after-pull-quote">{content}</div>;
}

export function BlockRenderer({
  blocks,
  className,
  blockClassName,
}: BlockRendererProps) {
  if (!blocks?.length) return null;

  return (
    <div className={className}>
      <style dangerouslySetInnerHTML={{ __html: PULL_QUOTE_CLEAR_STYLE }} />
      {blocks.map((block, i) => {
        let content: React.ReactNode;
        switch (block.type) {
          case "sponsor":
            content = <SponsorBlock key={i} data={block.data} />;
            break;
          case "imageGallery":
            content = <ImageGalleryBlock key={i} data={block.data} />;
            break;
          case "imageComparison":
            content = <ImageComparisonBlock key={i} data={block.data} />;
            break;
          case "pullQuote":
            content = <PullQuoteBlock key={i} data={block.data} />;
            break;
          case "keyTakeaways":
            content = <KeyTakeawaysBlock key={i} data={block.data} />;
            break;
          case "html":
          default:
            content =
              block.type === "html" && block.content ? (
                <div
                  dangerouslySetInnerHTML={{ __html: block.content }}
                  className={blockClassName ?? "contents"}
                />
              ) : null;
            break;
        }
        return content ? <React.Fragment key={i}>{wrapAfterPullQuote(i, blocks, content)}</React.Fragment> : null;
      })}
    </div>
  );
}
