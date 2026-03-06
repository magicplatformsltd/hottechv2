"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ImageGalleryLayout = "grid" | "masonry" | "slideshow";

export type ImageGalleryItem = {
  id: string;
  url: string;
  alt?: string;
};

export type ImageGalleryData = {
  layout: ImageGalleryLayout;
  images: ImageGalleryItem[];
};

type ImageGalleryBlockProps = {
  data: ImageGalleryData;
};

export function ImageGalleryBlock({ data }: ImageGalleryBlockProps) {
  const { layout, images } = data;
  const [slideIndex, setSlideIndex] = useState(0);

  const validImages = useMemo(
    () => images.filter((i) => i?.url && typeof i.url === "string"),
    [images]
  );

  if (!validImages.length) return null;

  if (layout === "slideshow") {
    const current = validImages[slideIndex % validImages.length];
    return (
      <div className="my-8 w-full">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-hot-gray">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative h-full w-full"
            >
              <Image
                src={current.url}
                alt={current.alt ?? ""}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 896px"
              />
            </motion.div>
          </AnimatePresence>
        </div>
        {validImages.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setSlideIndex((i) => (i - 1 + validImages.length) % validImages.length)}
              className="rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-hot-white"
              aria-label="Previous"
            >
              ←
            </button>
            <span className="font-sans text-sm text-gray-400">
              {slideIndex + 1} / {validImages.length}
            </span>
            <button
              type="button"
              onClick={() => setSlideIndex((i) => (i + 1) % validImages.length)}
              className="rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-hot-white"
              aria-label="Next"
            >
              →
            </button>
          </div>
        )}
      </div>
    );
  }

  if (layout === "masonry") {
    return (
      <div className="my-8 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
        {validImages.map((item) => (
          <div key={item.id} className="relative overflow-hidden rounded-lg">
            <Image
              src={item.url}
              alt={item.alt ?? ""}
              width={600}
              height={400}
              className="h-auto w-full object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
        ))}
      </div>
    );
  }

  // Grid (default)
  return (
    <div className="my-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {validImages.map((item) => (
        <div key={item.id} className="relative aspect-square overflow-hidden rounded-lg">
          <Image
            src={item.url}
            alt={item.alt ?? ""}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      ))}
    </div>
  );
}
