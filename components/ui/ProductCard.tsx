"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types/product";
import { getProductBrandName } from "@/lib/content-helpers";
import { getAwardById } from "@/lib/actions/award";
import { AwardBadge } from "@/components/public/AwardBadge";

const DEFAULT_GLOW_COLOR = "rgb(59 130 246)"; // tech blue

type ProductCardSize = "sm" | "md" | "lg";

const sizeClasses: Record<ProductCardSize, { container: string; image: string; padding: string }> = {
  sm: { container: "aspect-[3/4] max-h-52", image: "object-contain", padding: "pt-2 px-2 pb-14" },
  md: { container: "aspect-[3/4] max-h-72", image: "object-contain", padding: "pt-2 px-2 pb-16" },
  lg: { container: "aspect-[3/4] max-h-96", image: "object-contain", padding: "pt-3 px-3 pb-20" },
};

export type ProductCardProps = {
  /** Full product from products table (brand, name, slug, transparent_image, editorial_data, etc.). */
  product: Product & { primary_color?: string | null };
  /** Whether to show the editor rating pill. */
  showRating?: boolean;
  /** Card size; affects aspect and image scale. */
  size?: ProductCardSize;
  /** Optional base path for the product link (e.g. vertical "phones" → link to /phones/[slug]). Omit to render as non-link. */
  linkPrefix?: string;
  className?: string;
};

export function ProductCard({
  product,
  showRating = false,
  size = "md",
  linkPrefix,
  className = "",
}: ProductCardProps) {
  const glowColor = product.primary_color?.trim() || DEFAULT_GLOW_COLOR;
  const imageUrl = product.transparent_image ?? product.hero_image;
  const brandName = getProductBrandName(product);
  const rating = showRating && typeof product.editorial_data?.final_score === "number"
    ? product.editorial_data.final_score
    : null;
  const href = linkPrefix && (product.slug ?? product.id) ? `/${linkPrefix.replace(/^\//, "")}/${product.slug ?? product.id}` : undefined;

  const [award, setAward] = useState<Awaited<ReturnType<typeof getAwardById>>>(null);
  useEffect(() => {
    if (!product.award_id) {
      setAward(null);
      return;
    }
    let cancelled = false;
    getAwardById(product.award_id).then((a) => {
      if (!cancelled) setAward(a ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [product.award_id]);

  const sizes = size === "sm" ? "120px" : size === "md" ? "200px" : "280px";

  const content = (
    <div
      className={`relative group overflow-hidden rounded-xl border border-white/10 bg-gray-900/50 ${sizeClasses[size].container} ${className}`}
    >
      {/* Background glow — larger aura so it sits behind the bigger device image */}
      <div
        className="absolute inset-0 opacity-20 transition-opacity duration-300 group-hover:opacity-30"
        style={{
          background: `radial-gradient(ellipse 85% 85% at 50% 38%, ${glowColor}, transparent 68%)`,
        }}
        aria-hidden
      />

      {/* Award badge — top-right, above image and glow; z-30 so it sits in front */}
      {award && (
        <div className="absolute top-4 right-4 z-30 w-14 h-14 flex items-center justify-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] shrink-0">
          <AwardBadge award={award} scale={56 / 240} className="shrink-0" />
        </div>
      )}

      {/* Image — z-20 so badge (z-30) sits in front */}
      {imageUrl ? (
        <div className={`absolute inset-0 flex items-center justify-center z-20 ${sizeClasses[size].padding}`}>
          <Image
            src={imageUrl}
            alt={product.name}
            width={280}
            height={373}
            sizes={sizes}
            className={`relative w-full h-full transition-transform duration-500 group-hover:scale-105 ${sizeClasses[size].image}`}
          />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center z-20 text-gray-500 font-sans text-sm">
          No image
        </div>
      )}

      {/* Info overlay — name/brand left; score circle bottom-right */}
      <div className="absolute bottom-0 left-0 right-0 z-20 w-full p-4 bg-gradient-to-t from-black/80 to-transparent backdrop-blur-sm">
        <div className="flex justify-between items-end gap-2">
          <div className="min-w-0 max-w-[75%] min-h-[2.5rem] flex flex-col justify-end">
            <p className="font-sans text-base font-bold text-hot-white leading-tight line-clamp-2">
              {product.name}
            </p>
            {brandName && (
              <p className="font-sans text-xs text-gray-400 mt-0.5 truncate">
                {brandName}
              </p>
            )}
          </div>
          {rating !== null && (
            <div className="w-9 h-9 flex items-center justify-center rounded-full border border-white/30 bg-white/20 shrink-0 text-xs font-semibold text-hot-white">
              {rating}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-hot-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}
