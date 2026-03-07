"use client";

import { useRef } from "react";
import { ProductCard } from "@/components/ui/ProductCard";
import type { Product } from "@/lib/types/product";

const SCROLL_OFFSET = 300;

export type ProductCarouselProps = {
  /** Products to show in the carousel (e.g. first 15 published). */
  products: (Product & { primary_color?: string | null })[];
  /** Optional section title above the carousel. */
  title?: string;
  /** Base path for product links (e.g. vertical "phones" → /phones/[slug]). */
  linkPrefix: string;
  /** Whether to show the editor rating on each card. */
  showRating?: boolean;
  className?: string;
};

export function ProductCarousel({
  products,
  title,
  linkPrefix,
  showRating = true,
  className = "",
}: ProductCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  function scrollLeft() {
    scrollContainerRef.current?.scrollBy({ left: -SCROLL_OFFSET, behavior: "smooth" });
  }

  function scrollRight() {
    scrollContainerRef.current?.scrollBy({ left: SCROLL_OFFSET, behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <section className={`relative ${className}`}>
      {title && (
        <h2 className="text-xl font-semibold text-hot-white mb-4">
          {title}
        </h2>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={scrollLeft}
          aria-label="Scroll carousel left"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-40 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all text-hot-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={scrollRight}
          aria-label="Scroll carousel right"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-40 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all text-hot-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-6 px-8 md:px-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          role="list"
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="snap-start shrink-0 w-[200px] md:w-[210px] lg:w-[220px]"
              role="listitem"
            >
              <ProductCard
                product={product}
                showRating={showRating}
                size="md"
                linkPrefix={linkPrefix}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
