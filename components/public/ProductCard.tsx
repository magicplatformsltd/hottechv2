"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getProductById } from "@/lib/actions/product";
import type { Product } from "@/lib/types/product";
import type { ProductBoxBlockData } from "@/lib/types/post";

type ProductCardProps = {
  data: ProductBoxBlockData;
  className?: string;
};

function normalizeAffiliateLinks(product: Product | null): { retailer: string; url: string }[] {
  if (!product?.affiliate_links) return [];
  const links = product.affiliate_links;
  if (Array.isArray(links)) {
    return links
      .filter((item) => item && typeof item === "object" && "retailer" in item && "url" in item)
      .map((item) => ({
        retailer: String((item as { retailer: string }).retailer),
        url: String((item as { url: string }).url),
      }))
      .filter((x) => x.retailer || x.url);
  }
  if (typeof links === "object") {
    return Object.entries(links).map(([retailer, url]) => ({
      retailer,
      url: typeof url === "string" ? url : "",
    }));
  }
  return [];
}

export function ProductCard({ data, className = "" }: ProductCardProps) {
  const { productId, productName, config } = data;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getProductById(productId).then((p) => {
      if (!cancelled) {
        setProduct(p ?? null);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (loading) {
    return (
      <div
        className={`rounded-lg border border-white/10 bg-white/5 p-4 ${className}`}
        aria-busy="true"
      >
        <p className="text-sm text-gray-400">Loading product…</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div
        className={`rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 ${className}`}
      >
        <p className="text-sm text-amber-200">
          Product: {productName || productId || "Unknown"}
        </p>
        <p className="mt-1 text-xs text-gray-500">Product data could not be loaded.</p>
      </div>
    );
  }

  const displayDescription =
    (config.descriptionOverride && config.descriptionOverride.trim()) ||
    product.editorial_data?.bottom_line ||
    "";

  const showImage = config.showImage !== false;
  const imageType = config.imageType === "hero" ? "hero" : "transparent";
  const imageUrl =
    showImage &&
    (imageType === "hero" ? product.hero_image : product.transparent_image) &&
    (imageType === "hero" ? product.hero_image : product.transparent_image);
  const showReleaseDate = config.showReleaseDate !== false;
  const showStarRating = config.showStarRating !== false;
  const showProsCons = config.showProsCons !== false;
  const showKeySpecs = config.showKeySpecs !== false;
  const keySpecKeys = config.keySpecKeys ?? [];
  const includeAffiliateButtons = config.includeAffiliateButtons !== false;
  const selectedAffiliates = config.selectedAffiliates ?? [];

  const allAffiliates = normalizeAffiliateLinks(product);
  const displayAffiliates =
    includeAffiliateButtons && allAffiliates.length > 0
      ? selectedAffiliates.length > 0
        ? allAffiliates.filter((a) => selectedAffiliates.includes(a.retailer))
        : allAffiliates
      : [];

  const specs = product.specs && typeof product.specs === "object" ? product.specs : {};
  const displaySpecs =
    showKeySpecs && keySpecKeys.length > 0
      ? keySpecKeys.filter((k) => k in specs).map((k) => ({ key: k, value: specs[k] }))
      : showKeySpecs
        ? Object.entries(specs).map(([key, value]) => ({ key, value }))
        : [];

  const finalScore = product.editorial_data?.final_score;
  const pros = product.editorial_data?.pros ?? [];
  const cons = product.editorial_data?.cons ?? [];
  const releaseDate = product.release_date;

  return (
    <div
      className={`rounded-lg border border-white/10 bg-white/5 overflow-hidden ${className}`}
      data-product-id={product.id}
    >
      <div className="p-4 space-y-4">
        <div className="flex gap-4">
          {imageUrl && (
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-white/5">
              <Image
                src={imageUrl}
                alt={product.name ?? ""}
                fill
                className="object-contain"
                sizes="96px"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-sans text-lg font-semibold text-hot-white">
              {product.name}
            </h3>
            {product.brand && (
              <p className="text-sm text-gray-400">{product.brand}</p>
            )}
            {showReleaseDate && releaseDate && (
              <p className="mt-0.5 text-xs text-gray-500">
                Released: {new Date(releaseDate).toLocaleDateString()}
              </p>
            )}
            {showStarRating && finalScore != null && (
              <p className="mt-1 text-sm text-amber-400">
                ★ {Number(finalScore).toFixed(1)} / 10
              </p>
            )}
          </div>
        </div>

        {displayDescription && (
          <p className="font-sans text-sm text-gray-300">{displayDescription}</p>
        )}

        {displaySpecs.length > 0 && (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {displaySpecs.map(({ key, value }) => (
              <div key={key} className="flex gap-2">
                <dt className="text-sm text-gray-500">{key}:</dt>
                <dd className="text-sm text-hot-white">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        )}

        {showProsCons && (pros.length > 0 || cons.length > 0) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pros.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-green-400/90">
                  Pros
                </p>
                <ul className="mt-1 list-disc pl-4 text-sm text-gray-300">
                  {pros.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {cons.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-red-400/90">
                  Cons
                </p>
                <ul className="mt-1 list-disc pl-4 text-sm text-gray-300">
                  {cons.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {displayAffiliates.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
            {displayAffiliates.map(({ retailer, url }) => (
              <a
                key={retailer}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-hot-white px-3 py-1.5 text-sm font-medium text-hot-black hover:bg-hot-white/90"
              >
                Buy at {retailer}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
