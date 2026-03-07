/**
 * Schema.org Product JSON-LD for Google Rich Results.
 * Consumes product data and optional spec display map to output valid Product structured data.
 */

import type { Product, AffiliateLink } from "@/lib/types/product";
import { getBaseUrl } from "@/lib/url";

export type ProductSchemaOptions = {
  /** Flat map of spec property name -> display value for additionalProperty. */
  specsForSchema?: Record<string, string>;
  /** Block index on page (for unique @id when multiple products). */
  blockIndex?: number;
  /** Canonical URL of the page (optional; used for @id base). */
  pageUrl?: string;
};

function getOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return getBaseUrl();
}

function absoluteImageUrl(heroImage: string | null | undefined): string | undefined {
  if (!heroImage || typeof heroImage !== "string" || !heroImage.trim()) return undefined;
  const trimmed = heroImage.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  const base = getOrigin();
  return `${base}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

function normalizeOffers(affiliateLinks: Product["affiliate_links"]): { "@type": "Offer"; url: string; price?: string; priceCurrency?: string }[] {
  if (!affiliateLinks) return [];
  const links: AffiliateLink[] = Array.isArray(affiliateLinks)
    ? affiliateLinks.filter((item): item is AffiliateLink => item != null && typeof item === "object" && "url" in item && "retailer" in item)
    : Object.entries(affiliateLinks).map(([retailer, url]) => ({ retailer, url: typeof url === "string" ? url : "" }));
  return links
    .filter((l) => (l.url ?? "").trim())
    .map((l) => {
      const offer: { "@type": "Offer"; url: string; price?: string; priceCurrency?: string } = {
        "@type": "Offer",
        url: (l.url ?? "").trim(),
      };
      const amount = (l as { price_amount?: string }).price_amount?.trim();
      const currency = (l as { price_currency?: string }).price_currency?.trim();
      if (amount) offer.price = amount;
      if (currency) offer.priceCurrency = currency;
      return offer;
    });
}

/**
 * Builds a Schema.org Product JSON-LD object for the given product.
 * Use with <JsonLd data={generateProductSchema(product, options)} />.
 */
export function generateProductSchema(product: Product, options: ProductSchemaOptions = {}): object {
  const { specsForSchema = {}, blockIndex, pageUrl } = options;
  const baseUrl = pageUrl ?? getOrigin();
  const fragment = blockIndex != null ? `#product-${blockIndex}` : `#product-${product.id}`;
  const id = baseUrl ? `${baseUrl.replace(/\/$/, "")}${fragment}` : undefined;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    ...(id && { "@id": id }),
    name: product.name ?? undefined,
    description: (product.editorial_data?.bottom_line ?? product.seo_description ?? "").trim() || undefined,
    brand:
      product.brands?.name?.trim()
        ? { "@type": "Brand", name: product.brands.name.trim() }
        : undefined,
    image: absoluteImageUrl(product.hero_image) ?? absoluteImageUrl(product.transparent_image) ?? undefined,
  };

  const offers = normalizeOffers(product.affiliate_links);
  if (offers.length > 0) {
    schema.offers = offers.length === 1 ? offers[0] : offers;
  }

  const score = product.editorial_data?.final_score;
  if (typeof score === "number" && score >= 0 && score <= 10) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(score),
      bestRating: "10",
      worstRating: "0",
      ratingCount: "1",
    };
  }

  const additionalProps = Object.entries(specsForSchema)
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(([name, value]) => ({ "@type": "PropertyValue" as const, name: name.trim(), value: String(value).trim() }));
  if (additionalProps.length > 0) {
    schema.additionalProperty = additionalProps;
  }

  return schema;
}
