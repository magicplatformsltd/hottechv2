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

/** Brand row from brands table (joined on products.brand_id). */
export type Brand = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  created_at: string;
};

/** Key/value product specs (e.g. cpu, ram, display). Flat format. */
export type ProductSpecs = Record<string, string>;

/** One row for variant_matrix spec type (generic col1/col2). */
export type VariantMatrixEntry = { value1: string; value2: string };

/** Boolean spec with optional details (boolean spec type). */
export type BooleanWithDetails = { value: boolean; details: string };

/** Camera lens structured spec (camera_lens spec type). */
export type CameraLensData = {
  mp: string;
  aperture: string;
  focalLength: string;
  fov: string;
  lensType: string;
  sensorSize: string;
  pixelSize: string;
  autofocus: string;
  zoom: string;
  ois: boolean;
};

/** One dust/water pair for ip_rating spec type. */
export type IpRatingEntry = { dust: string; water: string };

/** Display panel structured spec (display_panel spec type). */
export type DisplayPanelData = {
  displayName: string;
  diagonalSize: string;
  screenToBodyRatio: string;
  panelType: string;
  colorDepth: string;
  resolution: string;
  aspectRatio: string;
  pixelDensity: string;
  refreshRate: string;
  pwm: string;
  hbmBrightness: string;
  peakBrightness: string;
  protection: string;
  hasDolbyVision: boolean;
  hasHDR10Plus: boolean;
  otherFeatures: string;
};

/** Nested specs by group. Values can be string, variant matrix, boolean with details, camera lens, display panel, or IP rating array. */
export type ProductSpecsNested = Record<
  string,
  Record<string, string | VariantMatrixEntry[] | BooleanWithDetails | CameraLensData | DisplayPanelData | IpRatingEntry[]>
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

function isCameraLensData(v: unknown): v is CameraLensData {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    "mp" in v &&
    "ois" in v &&
    typeof (v as CameraLensData).ois === "boolean"
  );
}

function isDisplayPanelData(v: unknown): v is DisplayPanelData {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    "hasDolbyVision" in v &&
    "hasHDR10Plus" in v &&
    typeof (v as DisplayPanelData).hasDolbyVision === "boolean" &&
    typeof (v as DisplayPanelData).hasHDR10Plus === "boolean"
  );
}

function isIpRatingEntryArray(v: unknown): v is IpRatingEntry[] {
  return (
    Array.isArray(v) &&
    (v.length === 0 || (v[0] != null && typeof v[0] === "object" && "dust" in v[0] && "water" in v[0]))
  );
}

/**
 * Get raw spec value (string, variant matrix array, IP rating array, boolean with details, camera lens, or display panel) for a given group + spec.
 */
export function getRawSpecValue(
  specs: ProductSpecsInput | null | undefined,
  groupName: string,
  specName: string
): string | VariantMatrixEntry[] | IpRatingEntry[] | BooleanWithDetails | CameraLensData | DisplayPanelData | undefined {
  if (!specs || typeof specs !== "object") return undefined;
  const first = Object.values(specs)[0];
  const isNested = typeof first === "object" && first !== null && !Array.isArray(first);
  if (isNested) {
    const group = (specs as ProductSpecsNested)[groupName];
    if (!group || typeof group !== "object") return undefined;
    const v = group[specName];
    if (typeof v === "string") return v;
    if (Array.isArray(v)) {
      if (isIpRatingEntryArray(v)) return v as IpRatingEntry[];
      return v as VariantMatrixEntry[];
    }
    if (isBooleanWithDetails(v)) return v as BooleanWithDetails;
    if (isCameraLensData(v)) return v as CameraLensData;
    if (isDisplayPanelData(v)) return v as DisplayPanelData;
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

/** Draft payload: staging data shown in preview; applied to live columns on publish. */
export type ProductDraftData = Partial<{
  name: string;
  brand_id: string | null;
  slug: string;
  announcement_date: string | null;
  release_date: string | null;
  discontinued_date: string | null;
  software_updates_years: number | null;
  security_updates_years: number | null;
  hero_image: string | null;
  transparent_image: string | null;
  template_id: string | null;
  category_id: number | null;
  seo_title: string | null;
  seo_description: string | null;
  award_id: string | null;
  specs: ProductSpecsInput;
  affiliate_links: AffiliateLinks;
  editorial_data: EditorialData;
  status: string | null;
  published_at: string | null;
}>;

export type Product = {
  id: string;
  name: string;
  /** FK to brands.id. */
  brand_id: string | null;
  /** Joined from brands table (Supabase alias: brands). */
  brands?: Brand | null;
  /** Joined from categories table (products.category_id). */
  categories?: { id?: number; name?: string; slug?: string } | null;
  /** Joined from product_tags junction (tags nested). */
  product_tags?: { tag_id?: number; tags?: { id: number; name: string; slug: string } }[] | null;
  slug: string;
  /** ISO date (YYYY-MM-DD) or null. */
  announcement_date?: string | null;
  /** ISO date (YYYY-MM-DD) or null. */
  release_date: string | null;
  /** ISO date (YYYY-MM-DD) or null. */
  discontinued_date?: string | null;
  /** Years of software/OS updates (e.g. 5). */
  software_updates_years?: number | null;
  /** Years of security updates (e.g. 7). */
  security_updates_years?: number | null;
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
  /** draft | published | pending_review. Aligned with posts. */
  status?: string | null;
  /** When the product is/was published; future = scheduled. */
  published_at?: string | null;
  /** Staging data for preview; applied to live on publish. */
  draft_data?: ProductDraftData | null;
};

/** Junction row linking a post to a product (many-to-many). */
export type PostProduct = {
  post_id: string;
  product_id: string;
  is_primary: boolean;
  created_at: string;
};
