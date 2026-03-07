/**
 * Types for the products table (tech hardware reviews / comparison blocks).
 * JSONB columns are typed below for specs, affiliate_links, and editorial_data.
 */

import type { SpecGroup } from "./template";

/** Blueprint for a product category: required spec labels and score labels. */
export type ProductTemplate = {
  id: string;
  name: string;
  slug: string;
  /** Grouped spec schema. Legacy DB may store string[]; normalize to SpecGroup[] in UI. */
  spec_schema: SpecGroup[] | string[];
  score_schema: string[];
  /** Spec labels to treat as "Key Specs" (legacy: from API; new: derived from spec_schema items where isKey). */
  key_specs?: string[];
  created_at: string;
  updated_at: string;
};

export type { SpecGroup, SpecItem } from "./template";

/** Key/value product specs (e.g. cpu, ram, display). Flat format. */
export type ProductSpecs = Record<string, string>;

/** One RAM + Storage pairing for variant_matrix spec type. */
export type VariantMatrixEntry = { ram: string; storage: string };

/** Boolean spec with optional details (boolean spec type). */
export type BooleanWithDetails = { value: boolean; details: string };

/** Nested specs by group. Values can be string, variant matrix array, or boolean with details. */
export type ProductSpecsNested = Record<
  string,
  Record<string, string | VariantMatrixEntry[] | BooleanWithDetails>
>;

/** Product specs may be stored flat (legacy) or nested by group. */
export type ProductSpecsInput = ProductSpecs | ProductSpecsNested;

/**
 * Flatten product specs to a single Record<specName, value> for display.
 * Handles both flat and nested. Variant matrix (array) values are omitted so callers that need them use getRawSpecValue.
 */
export function getFlattenedSpecs(specs: ProductSpecsInput | null | undefined): Record<string, string> {
  if (!specs || typeof specs !== "object") return {};
  const first = Object.values(specs)[0];
  const isNested = typeof first === "object" && first !== null && !Array.isArray(first);
  if (isNested) {
    const out: Record<string, string> = {};
    for (const group of Object.values(specs as ProductSpecsNested)) {
      if (group && typeof group === "object" && !Array.isArray(group)) {
        for (const [k, v] of Object.entries(group)) {
          if (typeof v === "string") out[k] = v;
          // boolean and variant_matrix omitted so callers use getRawSpecValue
        }
      }
    }
    return out;
  }
  return { ...(specs as ProductSpecs) };
}

function isBooleanWithDetails(v: unknown): v is BooleanWithDetails {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    "value" in v &&
    typeof (v as BooleanWithDetails).value === "boolean"
  );
}

/**
 * Get raw spec value (string, variant matrix array, or boolean with details) for a given group + spec.
 * Use when template has SpecGroup[] and you need to handle variant_matrix or boolean.
 */
export function getRawSpecValue(
  specs: ProductSpecsInput | null | undefined,
  groupName: string,
  specName: string
): string | VariantMatrixEntry[] | BooleanWithDetails | undefined {
  if (!specs || typeof specs !== "object") return undefined;
  const first = Object.values(specs)[0];
  const isNested = typeof first === "object" && first !== null && !Array.isArray(first);
  if (isNested) {
    const group = (specs as ProductSpecsNested)[groupName];
    if (!group || typeof group !== "object") return undefined;
    const v = group[specName];
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v as VariantMatrixEntry[];
    if (isBooleanWithDetails(v)) return v as BooleanWithDetails;
    return undefined;
  }
  const v = (specs as ProductSpecs)[specName];
  return typeof v === "string" ? v : undefined;
}

/** Single affiliate / "where to buy" link. */
export type AffiliateLink = {
  retailer: string;
  url: string;
  price?: string;
  /** Numeric price for display (e.g. "49.99"). */
  price_amount?: string;
  /** Currency code (GBP, USD, EUR, etc.). */
  price_currency?: string;
};

/** Affiliate links: array form (preferred) or legacy key-value. */
export type AffiliateLinks = AffiliateLink[] | Record<string, string>;

/** Editorial review data: bottom line, pros, cons, buy/dont-buy advice, sub-scores, final score. */
export type EditorialData = {
  bottom_line?: string;
  pros?: string[];
  cons?: string[];
  /** Global "Buy If" reasons (one per line in CMS). */
  buy_if?: string[];
  /** Global "Don't Buy If" reasons (one per line in CMS). */
  dont_buy_if?: string[];
  sub_scores?: Record<string, number>;
  final_score?: number;
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  slug: string;
  release_date: string | null;
  hero_image: string | null;
  transparent_image: string | null;
  template_id?: string | null;
  category_id?: number | null;
  seo_title?: string | null;
  seo_description?: string | null;
  /** FK to product_awards; null = no award. */
  award_id?: string | null;
  /** Flat or nested by group; use getFlattenedSpecs() for display. */
  specs: ProductSpecsInput;
  affiliate_links: AffiliateLinks;
  editorial_data: EditorialData;
  created_at: string;
  updated_at: string;
};

/** Junction row linking a post to a product (many-to-many). */
export type PostProduct = {
  post_id: string;
  product_id: string;
  is_primary: boolean;
  created_at: string;
};
