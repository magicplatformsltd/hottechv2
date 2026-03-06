"use client";

import type {
  SponsorBlockData,
  ImageGalleryData,
  ImageComparisonData,
} from "@/lib/types/post";
import { SponsorBlock } from "@/components/posts/SponsorBlock";
import { ImageGalleryBlock } from "@/components/posts/ImageGalleryBlock";
import { ImageComparisonBlock } from "@/components/posts/ImageComparisonBlock";

export type RenderedBlock =
  | { type: "html"; content: string }
  | { type: "sponsor"; data: SponsorBlockData }
  | { type: "imageGallery"; data: ImageGalleryData }
  | { type: "imageComparison"; data: ImageComparisonData };

type BlockRendererProps = {
  blocks: RenderedBlock[];
  className?: string;
  /** Applied to HTML segment wrappers (e.g. "contents" for prose flow) */
  blockClassName?: string;
};

export function BlockRenderer({
  blocks,
  className,
  blockClassName,
}: BlockRendererProps) {
  if (!blocks?.length) return null;

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "sponsor":
            return <SponsorBlock key={i} data={block.data} />;
          case "imageGallery":
            return <ImageGalleryBlock key={i} data={block.data} />;
          case "imageComparison":
            return <ImageComparisonBlock key={i} data={block.data} />;
          case "html":
          default:
            return block.content ? (
              <div
                key={i}
                dangerouslySetInnerHTML={{ __html: block.content }}
                className={blockClassName ?? "contents"}
              />
            ) : null;
        }
      })}
    </div>
  );
}
