/**
 * Types for the products table (tech hardware reviews / comparison blocks).
 * JSONB columns are typed below for specs, affiliate_links, and editorial_data.
 */

/** Blueprint for a product category: required spec labels and score labels. */
export type ProductTemplate = {
  id: string;
  name: string;
  slug: string;
  spec_schema: string[];
  score_schema: string[];
  /** Spec labels to treat as "Key Specs" in the Review Box (subset of spec_schema). */
  key_specs?: string[];
  created_at: string;
  updated_at: string;
};

/** Key/value product specs (e.g. cpu, ram, display). */
export type ProductSpecs = Record<string, string>;

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

/** Editorial review data: bottom line, pros, cons, sub-scores, final score. */
export type EditorialData = {
  bottom_line?: string;
  pros?: string[];
  cons?: string[];
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
  specs: ProductSpecs;
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
