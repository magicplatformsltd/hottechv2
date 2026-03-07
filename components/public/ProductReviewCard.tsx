"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Plus, Minus } from "lucide-react";
import { getProductById } from "@/lib/actions/product";
import { getTemplateById } from "@/lib/actions/template";
import { getAwardById } from "@/lib/actions/award";
import type { Product } from "@/lib/types/product";
import type { ProductTemplate } from "@/lib/types/product";
import type { ProductBoxBlockData } from "@/lib/types/post";
import { getCurrencySymbol } from "@/lib/constants/currencies";
import { AwardBadge } from "./AwardBadge";

type ProductReviewCardProps = {
  data: ProductBoxBlockData;
  className?: string;
};

type AffiliateLinkDisplay = {
  retailer: string;
  url: string;
  price_amount?: string;
  price_currency?: string;
};

function normalizeAffiliateLinks(product: Product | null): AffiliateLinkDisplay[] {
  if (!product?.affiliate_links) return [];
  const links = product.affiliate_links;
  if (Array.isArray(links)) {
    return links
      .filter((item) => item && typeof item === "object" && "retailer" in item && "url" in item)
      .map((item) => {
        const a = item as { retailer: string; url: string; price_amount?: string; price_currency?: string };
        return {
          retailer: String(a.retailer),
          url: String(a.url),
          price_amount: typeof a.price_amount === "string" ? a.price_amount : undefined,
          price_currency: typeof a.price_currency === "string" ? a.price_currency : undefined,
        };
      })
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

type AffiliateLinkOverride = {
  price_amount?: string;
  price_currency?: string;
  cta_text?: string;
  show_price?: boolean;
  show_retailer?: boolean;
};

function getButtonLabel(
  link: AffiliateLinkDisplay,
  override: AffiliateLinkOverride | undefined
): string {
  const ctaText = (override?.cta_text ?? "").trim();
  const showPrice = override?.show_price !== false;
  const showRetailer = override?.show_retailer !== false;
  const amount = (override?.price_amount ?? link.price_amount)?.trim();
  const code = (override?.price_currency ?? link.price_currency)?.trim();
  const symbol = getCurrencySymbol(code);
  const parts: string[] = [];
  if (ctaText) parts.push(ctaText);
  if (showPrice && amount) {
    const priceSeg = `${symbol}${amount}`;
    if (parts.length) parts.push(` : ${priceSeg}`);
    else parts.push(priceSeg);
  }
  if (showRetailer && link.retailer) parts.push(` at ${link.retailer}`);
  return parts.length ? parts.join("") : "Check price";
}

export function ProductReviewCard({ data, className = "" }: ProductReviewCardProps) {
  const { productId, productName, config } = data;
  const [product, setProduct] = useState<Product | null>(null);
  const [template, setTemplate] = useState<ProductTemplate | null>(null);
  const [award, setAward] = useState<Awaited<ReturnType<typeof getAwardById>>>(null);
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

  useEffect(() => {
    if (!product?.template_id) {
      setTemplate(null);
      return;
    }
    let cancelled = false;
    getTemplateById(product.template_id).then((t) => {
      if (!cancelled) setTemplate(t ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [product?.template_id]);

  useEffect(() => {
    if (!product?.award_id) {
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
  }, [product?.award_id]);

  if (loading) {
    return (
      <div
        className={`rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 ${className}`}
        aria-busy="true"
      >
        <p className="text-sm text-gray-400">Loading review…</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div
        className={`rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-6 ${className}`}
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

  const configKeySpecKeys = config.keySpecKeys ?? [];
  const templateKeySpecs = Array.isArray(template?.key_specs) ? template.key_specs : [];
  const keySpecKeysToShow =
    configKeySpecKeys.length > 0 ? configKeySpecKeys : templateKeySpecs;

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
  const keySpecsToShow = keySpecKeysToShow.filter((k) => k in specs).map((key) => ({
    key,
    value: String(specs[key] ?? "—"),
  }));

  const finalScore = product.editorial_data?.final_score;
  const showStarRating = config.showStarRating !== false;
  const showAward = config.showAward !== false;
  const subScores = product.editorial_data?.sub_scores ?? {};
  const subScoreEntries = Object.entries(subScores);

  const primaryAffiliate = displayAffiliates[0];
  const secondaryAffiliates = displayAffiliates.slice(1);

  const hasProsCons =
    config.showProsCons !== false &&
    ((product.editorial_data?.pros?.length ?? 0) + (product.editorial_data?.cons?.length ?? 0) > 0);

  return (
    <article
      className={`w-full rounded-xl border border-white/10 bg-white/5 dark:bg-slate-900/50 backdrop-blur-md overflow-hidden ${className}`}
      data-product-id={product.id}
    >
      <div className="p-5 sm:p-6">
        {/* Row 1: Editorial Hero — Image | Narrative | Validation */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
          {/* Column 1: Identity — Product Image */}
          <div className="md:col-span-3">
            {imageUrl ? (
              <div className="w-full aspect-square bg-white/5 rounded-xl p-4 flex items-center justify-center">
                <Image
                  src={imageUrl}
                  alt=""
                  width={400}
                  height={400}
                  className="w-full h-full object-contain"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
            ) : (
              <div className="w-full aspect-square bg-white/5 rounded-xl p-4 flex items-center justify-center text-gray-500 text-sm">
                No image
              </div>
            )}
          </div>

          {/* Column 2: Narrative — Name + Bottom Line */}
          <div className="md:col-span-6 flex flex-col justify-center">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              {product.name}
            </h2>
            {displayDescription && (
              <p className="text-lg opacity-90 leading-relaxed text-gray-700 dark:text-gray-200">
                {displayDescription}
              </p>
            )}
          </div>

          {/* Column 3: Validation — Award + Score (side-by-side on mobile, stacked on md) */}
          <div className="md:col-span-3 flex flex-row md:flex-col flex-wrap items-center justify-center md:justify-start gap-4">
            {showAward && award && (
              <div
                className="w-[120px] h-[120px] flex items-center justify-center shrink-0"
                aria-hidden
              >
                <AwardBadge award={award} scale={0.5} />
              </div>
            )}
            {showStarRating && finalScore != null && (
              <div
                className="shrink-0 flex items-center justify-center rounded-full border-2 border-amber-400/80 bg-amber-500/20 dark:bg-amber-500/15 w-16 h-16 sm:w-20 sm:h-20"
                aria-label={`Score: ${Number(finalScore).toFixed(1)} out of 10`}
              >
                <span className="text-xl sm:text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {Number(finalScore).toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Data Grid — KEY SPECS | BREAKDOWN (mobile: Breakdown first, then Specs) */}
        {(keySpecsToShow.length > 0 || subScoreEntries.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border-t border-white/10 pt-8">
            {/* KEY SPECS — on md order-1 (left); on mobile order-2 (after Breakdown) */}
            {keySpecsToShow.length > 0 && (
              <div className="md:order-1 order-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  KEY SPECS
                </h3>
                <dl className="space-y-0">
                  {keySpecsToShow.map(({ key, value }) => (
                    <div
                      key={key}
                      className="flex justify-between items-baseline py-2 border-b border-white/10 last:border-b-0"
                    >
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 capitalize">
                        {key.replace(/_/g, " ")}
                      </dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* BREAKDOWN — on md order-2 (right); on mobile order-1 (first) */}
            {subScoreEntries.length > 0 && (
              <div className="md:order-2 order-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  BREAKDOWN
                </h3>
                <div className="space-y-3">
                  {subScoreEntries.map(([label, score]) => {
                    const num = Number(score);
                    const pct = Math.min(100, Math.max(0, num * 10));
                    return (
                      <div key={label}>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                            {label.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm font-bold tabular-nums text-amber-500 dark:text-amber-400">
                            {Number.isFinite(num) ? num.toFixed(1) : "—"}
                          </span>
                        </div>
                        <div className="w-full bg-white/10 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Row 3: Verdict — PROS | CONS */}
        {hasProsCons && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border-t border-white/10 pt-8">
            {product.editorial_data?.pros && product.editorial_data.pros.length > 0 && (
              <div className="rounded-lg bg-green-500/5 p-4 sm:p-5 border border-green-500/20">
                <h3 className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 mb-3">
                  PROS
                </h3>
                <ul className="space-y-1.5">
                  {product.editorial_data.pros.map((pro, i) => (
                    <li
                      key={i}
                      className="text-sm text-gray-700 dark:text-gray-200 flex items-start gap-2"
                    >
                      <Plus
                        className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400 mt-0.5"
                        aria-hidden
                      />
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {product.editorial_data?.cons && product.editorial_data.cons.length > 0 && (
              <div className="rounded-lg bg-red-500/5 p-4 sm:p-5 border border-red-500/20">
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-3">
                  CONS
                </h3>
                <ul className="space-y-1.5">
                  {product.editorial_data.cons.map((con, i) => (
                    <li
                      key={i}
                      className="text-sm text-gray-700 dark:text-gray-200 flex items-start gap-2"
                    >
                      <Minus
                        className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5"
                        aria-hidden
                      />
                      <span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Row 4: Action Footer — Smart CTA */}
        {displayAffiliates.length > 0 && (
          <footer className="flex flex-col sm:flex-row flex-wrap items-center sm:items-center sm:justify-end gap-3 pt-6 border-t border-white/10">
            {primaryAffiliate && (
              <a
                href={primaryAffiliate.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-amber-500 px-6 py-3.5 text-base font-semibold text-gray-900 hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
              >
                {getButtonLabel(primaryAffiliate, config.affiliatePriceOverrides?.[primaryAffiliate.retailer])}
              </a>
            )}
            {secondaryAffiliates.length > 0 && (
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-end">
                {secondaryAffiliates.slice(0, 3).map((link) => (
                  <a
                    key={link.retailer}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto rounded-md border border-white/20 bg-white/5 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-slate-700/50 transition-colors text-center"
                  >
                    {getButtonLabel(link, config.affiliatePriceOverrides?.[link.retailer])}
                  </a>
                ))}
                {secondaryAffiliates.length > 3 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 px-1 self-center sm:self-auto">
                    +{secondaryAffiliates.length - 3} more
                  </span>
                )}
              </div>
            )}
          </footer>
        )}
      </div>
    </article>
  );
}
