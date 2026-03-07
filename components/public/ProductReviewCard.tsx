"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Plus, Minus, CheckCircle, XCircle } from "lucide-react";
import { getProductById } from "@/lib/actions/product";
import { getTemplateById } from "@/lib/actions/template";
import { getAwardById } from "@/lib/actions/award";
import type { Product, ProductSpecsInput, VariantMatrixEntry, IpRatingEntry, BooleanWithDetails, CameraLensData, DisplayPanelData } from "@/lib/types/product";
import { getFlattenedSpecs, getRawSpecValue } from "@/lib/types/product";
import type { ProductTemplate } from "@/lib/types/product";
import type { ProductBoxBlockData } from "@/lib/types/post";
import { getTemplateSchemaAsGroups } from "@/lib/types/template";
import type { SpecGroup, SpecItem } from "@/lib/types/template";
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

/** Format ISO date string for display; returns empty string if missing or invalid. */
function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate || typeof isoDate !== "string") return "";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

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

function normalizeCustomList(raw: string | string[] | null | undefined): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.filter((s) => typeof s === "string" && s.trim());
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string" && s.trim()) : [];
  } catch {
    return raw.trim() ? [raw.trim()] : [];
  }
}

/** Format variant matrix for Key Specs using template labels; two lines when both columns present. Respects hideLabelsPublicly. */
function formatVariantMatrixForCombiner(
  arr: VariantMatrixEntry[],
  templateSpec?: Pick<SpecItem, "matrixConfig">
): string {
  const hideLabels = templateSpec?.matrixConfig?.hideLabelsPublicly === true;
  const label1 = hideLabels ? "" : (templateSpec?.matrixConfig?.col1Label ?? "");
  const label2 = hideLabels ? "" : (templateSpec?.matrixConfig?.col2Label ?? "");
  const parts1 = [...new Set(arr.map((x) => (x.value1 ?? "").trim()).filter(Boolean))];
  const parts2 = [...new Set(arr.map((x) => (x.value2 ?? "").trim()).filter(Boolean))];
  const line1 = parts1.length > 0 ? (hideLabels ? parts1.join("/") : `${parts1.join("/")} ${label1}`.trim()) : "";
  const line2 = parts2.length > 0 ? (hideLabels ? parts2.join("/") : `${parts2.join("/")} ${label2}`.trim()) : "";
  if (line1 && line2) return `${line1}\n${line2}`;
  return line1 || line2 || "";
}

/** Format boolean-with-details for display: "No" | "Yes" | "Yes (details)". */
function formatBooleanWithDetails(obj: BooleanWithDetails): string {
  if (obj.value === false) return "No";
  const d = (obj.details ?? "").trim();
  return d ? `Yes (${d})` : "Yes";
}

/** Format camera lens data as GSMArena-style string: "50MP, f/1.8, 24mm (Wide), 1/1.28\", 1.22µm, PDAF, 2x, OIS" */
function formatCameraLensForDisplay(item: CameraLensData): string {
  const focalAndType =
    (item.focalLength ?? "").trim() && (item.lensType ?? "").trim()
      ? `${(item.focalLength ?? "").trim()} (${(item.lensType ?? "").trim()})`
      : (item.focalLength ?? "").trim() || (item.lensType ?? "").trim();
  const parts = [
    (item.mp ?? "").trim(),
    (item.aperture ?? "").trim(),
    focalAndType,
    (item.fov ?? "").trim(),
    (item.sensorSize ?? "").trim(),
    (item.pixelSize ?? "").trim(),
    (item.autofocus ?? "").trim(),
    (item.zoom ?? "").trim(),
  ].filter(Boolean);
  if (item.ois === true) parts.push("OIS");
  return parts.join(", ") || "";
}

/** Format display panel data as strict 7-line string. Uses whitespace-pre-line when rendered. */
function formatDisplayPanelForDisplay(item: DisplayPanelData): string {
  const formatUnit = (val: string | undefined, unit: string) => {
    if (!val) return "";
    const lowerVal = val.toLowerCase();
    const lowerUnit = unit.toLowerCase().trim();
    if (lowerVal.includes(lowerUnit)) return val;
    return `${val}${unit}`;
  };

  const sizeVal = formatUnit((item.diagonalSize ?? "").trim(), " inches");
  const resVal = formatUnit((item.resolution ?? "").trim(), " pixels");
  const densityVal = (item.pixelDensity ?? "").trim()
    ? `~${formatUnit((item.pixelDensity ?? "").trim(), " ppi")} density`
    : "";
  const refreshVal = (item.refreshRate ?? "").trim()
    ? `${formatUnit((item.refreshRate ?? "").trim(), "Hz")} Refresh Rate`
    : "";
  const pwmVal = (item.pwm ?? "").trim() ? `${formatUnit((item.pwm ?? "").trim(), "Hz")} PWM` : "";
  const hbmVal = (item.hbmBrightness ?? "").trim()
    ? `${formatUnit((item.hbmBrightness ?? "").trim(), " nits")} (HBM)`
    : "";
  const peakVal = (item.peakBrightness ?? "").trim()
    ? `${formatUnit((item.peakBrightness ?? "").trim(), " nits")} (Peak)`
    : "";

  const typeParts = [(item.panelType ?? "").trim(), (item.colorDepth ?? "").trim()].filter(Boolean);
  const lineType = typeParts.length > 0 ? `Type: ${typeParts.join(", ")}` : "";

  const sizeParts = [
    sizeVal,
    (item.screenToBodyRatio ?? "").trim() ? `(~${(item.screenToBodyRatio ?? "").trim()} screen-to-body ratio)` : "",
  ].filter(Boolean);
  const lineSize = sizeParts.length > 0 ? `Size: ${sizeParts.join(" ")}` : "";

  const resParts = [
    resVal,
    (item.aspectRatio ?? "").trim() ? `${(item.aspectRatio ?? "").trim()} ratio` : "",
    densityVal,
  ].filter(Boolean);
  const lineRes = resParts.length > 0 ? `Resolution: ${resParts.join(", ")}` : "";

  const ratingParts = [refreshVal, pwmVal].filter(Boolean);
  const lineRatings = ratingParts.length > 0 ? `Display Ratings: ${ratingParts.join(", ")}` : "";

  const brightParts = [hbmVal, peakVal].filter(Boolean);
  const lineBright = brightParts.length > 0 ? `Brightness: ${brightParts.join(" / ")}` : "";

  const featParts = [
    item.hasDolbyVision ? "Dolby Vision" : "",
    item.hasHDR10Plus ? "HDR10+" : "",
    (item.otherFeatures ?? "").trim(),
  ].filter(Boolean);
  const lineFeat = featParts.length > 0 ? `Features: ${featParts.join(", ")}` : "";

  const lineProt = (item.protection ?? "").trim() ? `Protection: ${(item.protection ?? "").trim()}` : "";

  const displayString = [lineType, lineSize, lineRes, lineRatings, lineBright, lineFeat, lineProt]
    .filter(Boolean)
    .join("\n");
  return displayString;
}

/** Format IP rating array as "IP68 / IP69". Empty returns "". Only IPXX returns "Not officially rated". */
function formatIpRatingForDisplay(arr: IpRatingEntry[]): string {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  const onlyXX = arr.every((p) => (p.dust ?? "X") === "X" && (p.water ?? "X") === "X");
  if (onlyXX) return "Not officially rated";
  return arr.map((pair) => `IP${pair.dust ?? "X"}${pair.water ?? "X"}`).join(" / ");
}

/** Combined key specs per group: { label: groupName, value: space-joined key spec values }. Handles variant_matrix, ip_rating. */
function getCombinedKeySpecs(
  productSpecs: ProductSpecsInput | null | undefined,
  templateSchema: SpecGroup[]
): { label: string; value: string }[] {
  const result: { label: string; value: string }[] = [];
  for (const group of templateSchema) {
    const groupName = group.groupName?.trim() || "General";
    const keySpecs = (group.specs ?? []).filter((s) => s.isKey);
    const values = keySpecs
      .map((s) => {
        const raw = getRawSpecValue(productSpecs, groupName, s.name ?? "");
        if (typeof raw === "string") return raw.trim();
        if (Array.isArray(raw) && raw.length > 0) {
          if (raw[0] != null && "dust" in raw[0] && "water" in raw[0])
            return formatIpRatingForDisplay(raw as IpRatingEntry[]);
          return formatVariantMatrixForCombiner(raw as VariantMatrixEntry[], s);
        }
        if (raw && typeof raw === "object" && !Array.isArray(raw) && "value" in raw)
          return formatBooleanWithDetails(raw as BooleanWithDetails);
        if (raw && typeof raw === "object" && !Array.isArray(raw) && "mp" in raw && "ois" in raw)
          return formatCameraLensForDisplay(raw as CameraLensData);
        if (raw && typeof raw === "object" && !Array.isArray(raw) && "hasDolbyVision" in raw && "hasHDR10Plus" in raw)
          return formatDisplayPanelForDisplay(raw as DisplayPanelData);
        return "";
      })
      .filter(Boolean);
    if (values.length > 0) {
      result.push({ label: groupName, value: values.join(" ") });
    }
  }
  return result;
}

export function ProductReviewCard({ data, className = "" }: ProductReviewCardProps) {
  const { productId, productName, config } = data;
  // Strict boolean: only explicit false (boolean or string "false") hides; backward compat treats undefined as show
  const isShow = (v: unknown) => v !== false && v !== "false";
  const showImageAttr = isShow(data.show_image);
  const showAwardAttr = isShow(data.show_award);
  const showSpecsAttr = isShow(data.show_specs);
  const showBreakdownAttr = isShow(data.show_breakdown);
  const showProsConsAttr = isShow(data.show_pros_cons);
  const showBuyIfAttr = data.show_buy_if === true;
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

  const showImage = showImageAttr && config.showImage !== false;
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

  const specs = getFlattenedSpecs(product.specs);
  const templateSchema = getTemplateSchemaAsGroups(template?.spec_schema);
  const combinedKeySpecs = templateSchema.length > 0 ? getCombinedKeySpecs(product.specs, templateSchema) : [];
  const keySpecsToShow = keySpecKeysToShow.filter((k) => k in specs).map((key) => ({
    key,
    value: String(specs[key] ?? "—"),
  }));
  const keySpecsDisplay = combinedKeySpecs.length > 0 ? combinedKeySpecs : keySpecsToShow.map(({ key, value }) => ({ label: key, value }));

  const finalScore = product.editorial_data?.final_score;
  const showStarRating = config.showStarRating !== false;
  const showAward = showAwardAttr && config.showAward !== false;
  const subScores = product.editorial_data?.sub_scores ?? {};
  const subScoreEntries = Object.entries(subScores);

  const customProsList = normalizeCustomList(data.custom_pros);
  const customConsList = normalizeCustomList(data.custom_cons);
  const displayPros = customProsList.length > 0 ? customProsList : (product.editorial_data?.pros ?? []);
  const displayCons = customConsList.length > 0 ? customConsList : (product.editorial_data?.cons ?? []);

  // Buy If / Don't Buy If: post-level overrides (data.custom_*) take precedence over global (product.editorial_data)
  const customBuyIfList = normalizeCustomList(data.custom_buy_if);
  const customDontBuyIfList = normalizeCustomList(data.custom_dont_buy_if);
  const buyIf = customBuyIfList.length > 0 ? customBuyIfList : (product.editorial_data?.buy_if ?? []);
  const dontBuyIf = customDontBuyIfList.length > 0 ? customDontBuyIfList : (product.editorial_data?.dont_buy_if ?? []);
  const hasBuyIf = buyIf.length > 0;
  const hasDontBuyIf = dontBuyIf.length > 0;

  const primaryAffiliate = displayAffiliates[0];
  const secondaryAffiliates = displayAffiliates.slice(1);

  const hasProsCons =
    showProsConsAttr &&
    config.showProsCons !== false &&
    (displayPros.length > 0 || displayCons.length > 0);

  const isSpecSheetTemplate = data.template === "spec_sheet";

  return (
    <article
      className={`w-full rounded-xl border border-white/10 bg-white/5 dark:bg-slate-900/50 backdrop-blur-md overflow-hidden ${className}`}
      data-product-id={product.id}
    >
      <div className="p-5 sm:p-6">
        {isSpecSheetTemplate ? (
          <>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{product.name}</h2>
            {/* Standalone Spec Sheet — GSMArena-style grouped table */}
            <div className="w-full bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-8">
              {templateSchema.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No spec schema. Assign a template to this product.</div>
              ) : (
                templateSchema.map((group) => {
                  const groupName = group.groupName?.trim() || "General";
                  const specRows = (group.specs ?? []).filter((spec) => {
                    const specName = spec.name?.trim() ?? "";
                    const val = getRawSpecValue(product.specs, groupName, specName);
                    if (typeof val === "string") return val.trim() !== "";
                    if (Array.isArray(val) && val.length > 0 && val[0] != null && "dust" in val[0] && "water" in val[0])
                      return true;
                    if (Array.isArray(val)) return val.some((x: any) => ((x.value1 ?? x.dust ?? "") + (x.value2 ?? x.water ?? "")).trim() !== "");
                    if (val && typeof val === "object" && !Array.isArray(val) && "value" in val) return true;
                    if (val && typeof val === "object" && !Array.isArray(val) && "mp" in val && "ois" in val)
                      return formatCameraLensForDisplay(val as CameraLensData).length > 0;
                    if (val && typeof val === "object" && !Array.isArray(val) && "hasDolbyVision" in val && "hasHDR10Plus" in val)
                      return formatDisplayPanelForDisplay(val as DisplayPanelData).length > 0;
                    return false;
                  });
                  if (specRows.length === 0) return null;
                  return (
                    <div key={group.id || groupName}>
                      <div className="bg-white/10 p-3 font-bold text-sm uppercase tracking-wider text-gray-200 dark:text-gray-300">
                        {groupName}
                      </div>
                      {specRows.map((spec) => {
                        const specName = spec.name?.trim() ?? "";
                        const rawValue = getRawSpecValue(product.specs, groupName, specName);
                        const display =
                          typeof rawValue === "string"
                            ? rawValue.trim()
                            : Array.isArray(rawValue) && rawValue.length > 0 && rawValue[0] != null && "dust" in rawValue[0] && "water" in rawValue[0]
                              ? formatIpRatingForDisplay(rawValue as IpRatingEntry[])
                              : Array.isArray(rawValue)
                                ? (() => {
                                    const hideLabels = (spec as SpecItem).matrixConfig?.hideLabelsPublicly === true;
                                    const label1 = hideLabels ? "" : ((spec as SpecItem).matrixConfig?.col1Label ?? "");
                                    const label2 = hideLabels ? "" : ((spec as SpecItem).matrixConfig?.col2Label ?? "");
                                    return (rawValue as VariantMatrixEntry[])
                                      .map((item) => {
                                        const v1 = (item.value1 ?? "").trim();
                                        const v2 = (item.value2 ?? "").trim();
                                        if (hideLabels) {
                                          if (v1 && v2) return `${v1} / ${v2}`;
                                          return v1 || v2;
                                        }
                                        if (v1 && v2) return `${v1} ${label1} / ${v2} ${label2}`.trim();
                                        if (v1) return `${v1} ${label1}`.trim();
                                        return `${v2} ${label2}`.trim();
                                      })
                                      .filter(Boolean)
                                      .join(", ");
                                  })()
                                : rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && "value" in rawValue
                                ? formatBooleanWithDetails(rawValue as BooleanWithDetails)
                                : rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && "mp" in rawValue && "ois" in rawValue
                                  ? formatCameraLensForDisplay(rawValue as CameraLensData)
                                  : rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && "hasDolbyVision" in rawValue && "hasHDR10Plus" in rawValue
                                    ? formatDisplayPanelForDisplay(rawValue as DisplayPanelData)
                                    : "";
                        if (!display) return null;
                        let rowLabel = specName.replace(/_/g, " ");
                        if (
                          rawValue &&
                          typeof rawValue === "object" &&
                          "displayName" in rawValue &&
                          (rawValue as { displayName?: string }).displayName
                        ) {
                          rowLabel = String((rawValue as { displayName: string }).displayName).trim();
                        }
                        const isDisplayPanel = rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && "hasDolbyVision" in rawValue && "hasHDR10Plus" in rawValue;
                        return (
                          <div
                            key={spec.id || specName}
                            className="flex border-b border-white/5 last:border-b-0"
                          >
                            <div className="w-1/3 font-medium text-gray-400 p-3 text-sm capitalize">
                              {rowLabel}
                            </div>
                            <div className={`w-2/3 text-gray-900 dark:text-white p-3 text-sm ${isDisplayPanel ? "whitespace-pre-line" : ""}`}>
                              {display}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
              {/* KEY DATES & SUPPORT — same structure as dynamic spec groups */}
              {(product.announcement_date ||
                product.release_date ||
                product.discontinued_date ||
                product.software_updates_years != null ||
                product.security_updates_years != null) && (
                <div>
                  <div className="bg-white/10 p-3 font-bold text-sm uppercase tracking-wider text-gray-200 dark:text-gray-300">
                    KEY DATES &amp; SUPPORT
                  </div>
                  {product.announcement_date && (
                    <div className="flex border-b border-white/5 last:border-b-0">
                      <div className="w-1/3 font-medium text-gray-400 p-3 text-sm capitalize">
                        Announced
                      </div>
                      <div className="w-2/3 text-gray-900 dark:text-white p-3 text-sm">
                        {formatDate(product.announcement_date)}
                      </div>
                    </div>
                  )}
                  {product.release_date && (
                    <div className="flex border-b border-white/5 last:border-b-0">
                      <div className="w-1/3 font-medium text-gray-400 p-3 text-sm capitalize">
                        Released
                      </div>
                      <div className="w-2/3 text-gray-900 dark:text-white p-3 text-sm">
                        {formatDate(product.release_date)}
                      </div>
                    </div>
                  )}
                  {product.discontinued_date && (
                    <div className="flex border-b border-white/5 last:border-b-0">
                      <div className="w-1/3 font-medium text-gray-400 p-3 text-sm capitalize">
                        Discontinued
                      </div>
                      <div className="w-2/3 text-gray-900 dark:text-white p-3 text-sm">
                        {formatDate(product.discontinued_date)}
                      </div>
                    </div>
                  )}
                  {product.software_updates_years != null && (
                    <div className="flex border-b border-white/5 last:border-b-0">
                      <div className="w-1/3 font-medium text-gray-400 p-3 text-sm capitalize">
                        OS Updates
                      </div>
                      <div className="w-2/3 text-gray-900 dark:text-white p-3 text-sm">
                        {product.software_updates_years} Years
                      </div>
                    </div>
                  )}
                  {product.security_updates_years != null && (
                    <div className="flex border-b border-white/5 last:border-b-0">
                      <div className="w-1/3 font-medium text-gray-400 p-3 text-sm capitalize">
                        Security Updates
                      </div>
                      <div className="w-2/3 text-gray-900 dark:text-white p-3 text-sm">
                        {product.security_updates_years} Years
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
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
          </>
        ) : (
          <>
        {/* Row 1: Editorial Hero — Image | Narrative | Validation */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
          {/* Column 1: Identity — Product Image */}
          {showImageAttr && (
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
          )}

          {/* Column 2: Narrative — Name + Bottom Line */}
          <div className={`flex flex-col justify-center ${!showImageAttr ? "md:col-span-9" : "md:col-span-6"}`}>
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              {product.name}
            </h2>
            {isShow(data.show_bottom_line) && displayDescription && (
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
            {isShow(data.show_star_rating) && showStarRating && finalScore != null && (
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
        {(showSpecsAttr || showBreakdownAttr) && (keySpecsDisplay.length > 0 || subScoreEntries.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border-t border-white/10 pt-8">
            {/* KEY SPECS — combined by group when template has SpecGroup[]; else flat list */}
            {showSpecsAttr && keySpecsDisplay.length > 0 && (
              <div className={showBreakdownAttr ? "md:order-1 order-2" : "md:col-span-2"}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  KEY SPECS
                </h3>
                <dl className="space-y-0">
                  {keySpecsDisplay.map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex justify-between items-baseline py-2 border-b border-white/10 last:border-b-0"
                    >
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 capitalize">
                        {label.replace(/_/g, " ")}
                      </dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white whitespace-pre-line">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* BREAKDOWN — on md order-2 (right); on mobile order-1 (first); full width if no specs */}
            {showBreakdownAttr && subScoreEntries.length > 0 && (
              <div className={showSpecsAttr ? "md:order-2 order-1" : "md:col-span-2"}>
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
        {showProsConsAttr && hasProsCons && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border-t border-white/10 pt-8">
            {displayPros.length > 0 && (
              <div className="rounded-lg bg-green-500/5 p-4 sm:p-5 border border-green-500/20">
                <h3 className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 mb-3">
                  PROS
                </h3>
                <ul className="space-y-1.5">
                  {displayPros.map((pro, i) => (
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
            {displayCons.length > 0 && (
              <div className="rounded-lg bg-red-500/5 p-4 sm:p-5 border border-red-500/20">
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-3">
                  CONS
                </h3>
                <ul className="space-y-1.5">
                  {displayCons.map((con, i) => (
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

        {/* Buy If / Don't Buy If — conversion block right above CTA */}
        {showBuyIfAttr && (hasBuyIf || hasDontBuyIf) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-t border-white/10 pt-8">
            {hasBuyIf && (
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6">
                <h3 className="text-green-400 font-bold mb-4">
                  Buy it if...
                </h3>
                <ul className="space-y-2">
                  {buyIf.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-gray-700 dark:text-gray-200 flex items-start gap-2"
                    >
                      <CheckCircle className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400 mt-0.5" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hasDontBuyIf && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
                <h3 className="text-red-400 font-bold mb-4">
                  Don&apos;t buy it if...
                </h3>
                <ul className="space-y-2">
                  {dontBuyIf.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-gray-700 dark:text-gray-200 flex items-start gap-2"
                    >
                      <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" aria-hidden />
                      <span>{item}</span>
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
          </>
        )}
      </div>
    </article>
  );
}
