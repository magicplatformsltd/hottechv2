/**
 * Types for the products table (tech hardware reviews / comparison blocks).
 * JSONB columns are typed below for specs, affiliate_links, and editorial_data.
 */

/** Key/value product specs (e.g. cpu, ram, display). */
export type ProductSpecs = Record<string, string>;

/** Affiliate link keys and URLs (e.g. amazon, howl). */
export type AffiliateLinks = Record<string, string>;

/** Editorial review data: pros, cons, sub-scores, final score. */
export type EditorialData = {
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
