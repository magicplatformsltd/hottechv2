"use client";

import Image from "next/image";
import { ReactCompareSlider } from "react-compare-slider";

export type ImageComparisonData = {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
};

type ImageComparisonBlockProps = {
  data: ImageComparisonData;
};

export function ImageComparisonBlock({ data }: ImageComparisonBlockProps) {
  const { beforeUrl, afterUrl, beforeLabel, afterLabel } = data;

  if (!beforeUrl || !afterUrl) return null;

  return (
    <div className="my-8 w-full">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl">
        <ReactCompareSlider
          className="h-full w-full"
          itemOne={
            <div className="relative h-full w-full">
              <Image
                src={beforeUrl}
                alt={beforeLabel ?? "Before"}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 896px"
              />
              {beforeLabel && (
                <span className="absolute left-3 top-3 z-10 rounded bg-black/60 px-2.5 py-1 font-sans text-sm text-white">
                  {beforeLabel}
                </span>
              )}
            </div>
          }
          itemTwo={
            <div className="relative h-full w-full">
              <Image
                src={afterUrl}
                alt={afterLabel ?? "After"}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 896px"
              />
              {afterLabel && (
                <span className="absolute right-3 top-3 z-10 rounded bg-black/60 px-2.5 py-1 font-sans text-sm text-white">
                  {afterLabel}
                </span>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}
