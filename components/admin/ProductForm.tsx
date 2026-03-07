"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, Eye, Pencil, Calendar } from "lucide-react";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { upsertProduct, publishProductDraft } from "@/lib/actions/product";
import { createBrand } from "@/lib/actions/brand";
import { createTag } from "@/lib/actions/tags";
import { TagInput, type SelectedTag } from "@/app/components/admin/posts/TagInput";
import type { Product, Brand, ProductSpecsNested, EditorialData, ProductTemplate, AffiliateLink, VariantMatrixEntry, IpRatingEntry, BooleanWithDetails, CameraLensData, DisplayPanelData } from "@/lib/types/product";
import type { ProductSpecsInput } from "@/lib/types/product";
import { getSpecLabelsFromSchema, getTemplateSchemaAsGroups } from "@/lib/types/template";
import type { SpecGroup, SpecItem } from "@/lib/types/template";
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY_CODE } from "@/lib/constants/currencies";
import type { ProductAwardRecord } from "@/lib/types/award";
import type { CategoryRow } from "@/lib/actions/categories";
import { UniversalImagePicker } from "@/app/components/admin/shared/UniversalImagePicker";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { PRODUCT_PUBLISH_TIMEZONE } from "@/lib/constants/datetime";

function toDatetimeLocalInTz(iso: string | null, timezone: string): string {
  if (!iso) return "";
  try {
    return formatInTimeZone(new Date(iso), timezone, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

function fromDatetimeLocalToUtc(localStr: string, timezone: string): string {
  if (!localStr || localStr.length < 16) return "";
  try {
    const [datePart, timePart] = localStr.split("T");
    const [y, m, d] = (datePart ?? "").split("-").map(Number);
    const [h, min] = (timePart ?? "").split(":").map(Number);
    const localDate = new Date(y, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0, 0);
    return fromZonedTime(localDate, timezone).toISOString();
  } catch {
    return "";
  }
}

function getTimezoneLabel(timezone: string): string {
  try {
    return formatInTimeZone(new Date(), timezone, "zzz");
  } catch {
    return timezone;
  }
}

/** Return datetime-local string for now + 24 hours in the given timezone. */
function getDefaultScheduledTimeLocal(timezone: string): string {
  const in24 = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return formatInTimeZone(in24, timezone, "yyyy-MM-dd'T'HH:mm");
}

type ProductFormProps = {
  product: Product | null;
  brands?: Brand[];
  tags?: { id: number; name: string | null; slug: string | null }[];
  templates?: ProductTemplate[];
  categories?: CategoryRow[];
  awards?: ProductAwardRecord[];
  /** When provided, called after successful save instead of redirecting to /admin/products. */
  onSuccess?: () => void;
};

type CategoryOption = { id: number; label: string };

function buildCategoryTreeOptions(categories: CategoryRow[]): CategoryOption[] {
  const byParent = new Map<number | null, CategoryRow[]>();
  for (const c of categories) {
    const key = c.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  const result: CategoryOption[] = [];
  function visit(parentId: number | null, depth: number) {
    const list = byParent.get(parentId) ?? [];
    list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    const prefix = depth === 0 ? "" : "—".repeat(depth) + " ";
    for (const c of list) {
      result.push({ id: c.id, label: prefix + (c.name ?? "") });
      visit(c.id, depth + 1);
    }
  }
  visit(null, 0);
  return result;
}

function normalizeAffiliateLinks(links: Product["affiliate_links"]): AffiliateLink[] {
  if (Array.isArray(links)) {
    return links.map((item) => {
      const a = item as AffiliateLink;
      return {
        retailer: typeof a.retailer === "string" ? a.retailer : "",
        url: typeof a.url === "string" ? a.url : "",
        price: typeof a.price === "string" ? a.price : undefined,
        price_amount: typeof a.price_amount === "string" ? a.price_amount : undefined,
        price_currency: typeof a.price_currency === "string" ? a.price_currency : undefined,
      };
    });
  }
  if (links && typeof links === "object" && !Array.isArray(links)) {
    return Object.entries(links).map(([retailer, url]) => ({
      retailer,
      url: typeof url === "string" ? url : "",
    }));
  }
  return [];
}

type SubScoreEntry = { label: string; value: number };

function emptyProduct(): Partial<Product> {
  return {
    name: "",
    brand_id: null,
    slug: "",
    release_date: null,
    hero_image: null,
    transparent_image: null,
    specs: {},
    affiliate_links: {},
    editorial_data: {},
  };
}

const DEFAULT_CAMERA_LENS: CameraLensData = {
  mp: "",
  aperture: "",
  focalLength: "",
  fov: "",
  lensType: "",
  sensorSize: "",
  pixelSize: "",
  autofocus: "",
  zoom: "",
  ois: false,
};

const DEFAULT_DISPLAY_PANEL: DisplayPanelData = {
  displayName: "",
  diagonalSize: "",
  screenToBodyRatio: "",
  panelType: "",
  colorDepth: "",
  resolution: "",
  aspectRatio: "",
  pixelDensity: "",
  refreshRate: "",
  pwm: "",
  hbmBrightness: "",
  peakBrightness: "",
  protection: "",
  hasDolbyVision: false,
  hasHDR10Plus: false,
  otherFeatures: "",
};

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

/** Detect if specs are stored in nested shape (group -> spec -> value). */
function isNestedSpecs(specs: ProductSpecsInput | null | undefined): specs is ProductSpecsNested {
  if (!specs || typeof specs !== "object") return false;
  const first = Object.values(specs)[0];
  return typeof first === "object" && first !== null && !Array.isArray(first);
}

/**
 * Build nested spec state from product data and template schema.
 * Migrates legacy flat productSpecs into the grouped structure; preserves values when switching templates.
 */
function initializeSpecs(
  productSpecs: ProductSpecsInput | null | undefined,
  templateSchema: SpecGroup[]
): ProductSpecsNested {
  const nested = isNestedSpecs(productSpecs) ? (productSpecs as ProductSpecsNested) : null;
  const flat: Record<string, string> =
    !nested && productSpecs && typeof productSpecs === "object"
      ? (productSpecs as Record<string, string>)
      : {};
  // When re-applying (e.g. switching template), flatten nested so we preserve values by spec name
  const flatFromNested: Record<string, any> = nested
    ? Object.values(nested).reduce(
        (acc, group) => {
          if (group && typeof group === "object")
            for (const [k, v] of Object.entries(group)) if (typeof v === "string") acc[k] = v;
          return acc;
        },
        {} as Record<string, any>
      )
    : {};
  const out: ProductSpecsNested = {};
  for (const group of templateSchema) {
    const groupName = group.groupName?.trim() || "General";
    if (!out[groupName]) out[groupName] = {};
    for (const spec of group.specs ?? []) {
      const name = spec.name?.trim();
      if (!name) continue;
      const specType = spec.type ?? "text";
      if (specType === "variant_matrix") {
        const raw = nested?.[groupName]?.[name];
        const arr = Array.isArray(raw)
          ? (raw as VariantMatrixEntry[]).map((x) => ({
              value1: (x as any).value1 ?? (x as any).ram ?? "",
              value2: (x as any).value2 ?? (x as any).storage ?? "",
            }))
          : [{ value1: "", value2: "" }];
        out[groupName][name] = arr.length > 0 ? arr : [{ value1: "", value2: "" }];
      } else if (specType === "boolean") {
        const raw = nested?.[groupName]?.[name];
        const obj =
          raw &&
          typeof raw === "object" &&
          !Array.isArray(raw) &&
          "value" in raw &&
          typeof (raw as BooleanWithDetails).value === "boolean"
            ? (raw as BooleanWithDetails)
            : { value: false, details: "" };
        out[groupName][name] = {
          value: Boolean(obj.value),
          details: typeof obj.details === "string" ? obj.details : "",
        };
      } else if (specType === "camera_lens") {
        const raw = nested?.[groupName]?.[name];
        const lens = isCameraLensData(raw)
          ? {
              mp: String(raw.mp ?? ""),
              aperture: String(raw.aperture ?? ""),
              focalLength: String(raw.focalLength ?? ""),
              fov: String((raw as CameraLensData).fov ?? ""),
              lensType: String(raw.lensType ?? ""),
              sensorSize: String(raw.sensorSize ?? ""),
              pixelSize: String(raw.pixelSize ?? ""),
              autofocus: String(raw.autofocus ?? ""),
              zoom: String(raw.zoom ?? ""),
              ois: Boolean(raw.ois),
            }
          : { ...DEFAULT_CAMERA_LENS };
        out[groupName][name] = lens;
      } else if (specType === "display_panel") {
        const raw = nested?.[groupName]?.[name];
        const panel = isDisplayPanelData(raw)
          ? {
              displayName: String(raw.displayName ?? ""),
              diagonalSize: String(raw.diagonalSize ?? ""),
              screenToBodyRatio: String(raw.screenToBodyRatio ?? ""),
              panelType: String(raw.panelType ?? ""),
              colorDepth: String(raw.colorDepth ?? ""),
              resolution: String(raw.resolution ?? ""),
              aspectRatio: String(raw.aspectRatio ?? ""),
              pixelDensity: String(raw.pixelDensity ?? ""),
              refreshRate: String(raw.refreshRate ?? ""),
              pwm: String(raw.pwm ?? ""),
              hbmBrightness: String(raw.hbmBrightness ?? ""),
              peakBrightness: String(raw.peakBrightness ?? ""),
              protection: String(raw.protection ?? ""),
              hasDolbyVision: Boolean(raw.hasDolbyVision),
              hasHDR10Plus: Boolean(raw.hasHDR10Plus),
              otherFeatures: String(raw.otherFeatures ?? ""),
            }
          : { ...DEFAULT_DISPLAY_PANEL };
        out[groupName][name] = panel;
      } else if (specType === "ip_rating") {
        const raw = nested?.[groupName]?.[name];
        const arr = Array.isArray(raw) && raw.length > 0 && raw[0] != null && "dust" in raw[0] && "water" in raw[0]
          ? (raw as IpRatingEntry[]).map((x) => ({ dust: String(x.dust ?? "X"), water: String(x.water ?? "X") }))
          : [{ dust: "X", water: "X" }];
        out[groupName][name] = arr.length > 0 ? arr : [{ dust: "X", water: "X" }];
      } else {
        const value =
          nested?.[groupName]?.[name] ?? flat[name] ?? flatFromNested[name] ?? "";
        out[groupName][name] = typeof value === "string" ? String(value ?? "").trim() : "";
      }
    }
  }
  return out;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "";
}

/** Merge draft_data over base product so the form shows draft values (e.g. imported products that only have draft_data). */
function mergeDraftOverProduct(product: Product | null): Partial<Product> {
  const p = product ?? emptyProduct();
  const draft = (p as Product).draft_data;
  if (!draft || typeof draft !== "object") return p as Partial<Product>;
  return { ...p, ...draft } as Partial<Product>;
}

export function ProductForm({ product, brands = [], tags = [], templates = [], categories = [], awards = [], onSuccess }: ProductFormProps) {
  const router = useRouter();
  const initial = useMemo(() => mergeDraftOverProduct(product), [product]);

  const categoryOptions = useMemo(() => buildCategoryTreeOptions(categories), [categories]);
  const availableTagOptions = useMemo(
    () => tags.map((t) => ({ id: t.id, name: t.name ?? "", slug: t.slug ?? "" })),
    [tags]
  );
  const initialProductTags = useMemo(() => {
    const pt = product?.product_tags ?? [];
    return pt
      .map((p) => p.tags)
      .filter((t): t is { id: number; name: string; slug: string } => t != null && typeof t.id === "number")
      .map((t) => ({ id: t.id, name: t.name ?? "" }));
  }, [product?.product_tags]);

  const [templateId, setTemplateId] = useState<string | "">(
    initial.template_id ?? ""
  );
  const [categoryId, setCategoryId] = useState<number | "">(
    initial.category_id != null ? initial.category_id : ""
  );
  const [name, setName] = useState(initial.name ?? "");
  const [brandId, setBrandId] = useState<string | "">(() => {
    const id = initial.brand_id ?? (product?.brands as Brand | null)?.id ?? "";
    if (id) return String(id);
    const legacyBrandName = (initial as { brand?: string }).brand;
    if (legacyBrandName && brands.length) {
      const found = brands.find((b) => b.name === legacyBrandName);
      return found?.id ?? "";
    }
    return "";
  });
  const [newBrandName, setNewBrandName] = useState("");
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>(initialProductTags);
  const [slug, setSlug] = useState(initial.slug ?? "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(initial.slug?.trim()));
  const [announcementDate, setAnnouncementDate] = useState(
    (initial as { announcement_date?: string | null }).announcement_date?.slice(0, 10) ?? ""
  );
  const [releaseDate, setReleaseDate] = useState(
    initial.release_date ? initial.release_date.slice(0, 10) : ""
  );
  const [discontinuedDate, setDiscontinuedDate] = useState(
    (initial as { discontinued_date?: string | null }).discontinued_date?.slice(0, 10) ?? ""
  );
  const [softwareUpdatesYears, setSoftwareUpdatesYears] = useState<string>(() => {
    const v = (initial as { software_updates_years?: number | null }).software_updates_years;
    return v != null && !Number.isNaN(Number(v)) ? String(v) : "";
  });
  const [securityUpdatesYears, setSecurityUpdatesYears] = useState<string>(() => {
    const v = (initial as { security_updates_years?: number | null }).security_updates_years;
    return v != null && !Number.isNaN(Number(v)) ? String(v) : "";
  });
  const [seoTitle, setSeoTitle] = useState(initial.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(initial.seo_description ?? "");
  const [awardId, setAwardId] = useState<string | "">(initial.award_id ?? "");
  const [awardSearchOpen, setAwardSearchOpen] = useState(false);
  const [awardSearchQuery, setAwardSearchQuery] = useState("");
  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLink[]>(() =>
    normalizeAffiliateLinks(initial.affiliate_links as any)
  );
  const [heroImage, setHeroImage] = useState<string | null>(
    initial.hero_image ?? null
  );
  const [transparentImage, setTransparentImage] = useState<string | null>(
    initial.transparent_image ?? null
  );
  const [specGroups, setSpecGroups] = useState<ProductSpecsNested>(() =>
    initializeSpecs(
      initial.specs ?? {},
      getTemplateSchemaAsGroups(templates.find((t) => t.id === (initial.template_id ?? ""))?.spec_schema)
    )
  );
  const [bottomLine, setBottomLine] = useState(
    initial.editorial_data?.bottom_line ?? ""
  );
  const [pros, setPros] = useState<string[]>(
    initial.editorial_data?.pros?.length
      ? [...initial.editorial_data.pros]
      : [""]
  );
  const [cons, setCons] = useState<string[]>(
    initial.editorial_data?.cons?.length
      ? [...initial.editorial_data.cons]
      : [""]
  );
  const [buyIfText, setBuyIfText] = useState(
    (initial.editorial_data?.buy_if?.length ? initial.editorial_data.buy_if.join("\n") : "") ?? ""
  );
  const [dontBuyIfText, setDontBuyIfText] = useState(
    (initial.editorial_data?.dont_buy_if?.length ? initial.editorial_data.dont_buy_if.join("\n") : "") ?? ""
  );
  const [subScores, setSubScores] = useState<SubScoreEntry[]>(() => {
    const ed = initial.editorial_data?.sub_scores;
    if (ed && Object.keys(ed).length > 0) {
      return Object.entries(ed).map(([label, value]) => ({
        label,
        value: Number(value) || 0,
      }));
    }
    return [];
  });
  const [finalScore, setFinalScore] = useState<number>(
    initial.editorial_data?.final_score ?? 0
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [publishDateLocal, setPublishDateLocal] = useState(() =>
    toDatetimeLocalInTz(product?.published_at ?? null, PRODUCT_PUBLISH_TIMEZONE)
  );

  type StatusDropdownValue = "draft" | "pending_review" | "published" | "scheduled";
  const [statusDropdown, setStatusDropdown] = useState<StatusDropdownValue>(() => {
    const draft = product?.draft_data;
    const s = (draft?.status ?? product?.status) as string | undefined;
    const at = draft?.published_at ?? product?.published_at;
    if (s === "published" && at && new Date(at) > new Date()) return "scheduled";
    if (s === "pending_review" || s === "published" || s === "draft") return s as StatusDropdownValue;
    return "draft";
  });

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const previewUrl =
    product?.slug && selectedTemplate?.slug
      ? `/${selectedTemplate.slug}/${product.slug}?preview=true`
      : null;
  const canPublish = Boolean(product?.id && (product.draft_data || product.status !== "published"));

  const isScheduled = (() => {
    if (!publishDateLocal) return false;
    const utc = fromDatetimeLocalToUtc(publishDateLocal, PRODUCT_PUBLISH_TIMEZONE);
    return !!utc && new Date(utc) > new Date();
  })();

  useEffect(() => {
    const at = product?.draft_data?.published_at ?? product?.published_at ?? null;
    setPublishDateLocal(toDatetimeLocalInTz(at, PRODUCT_PUBLISH_TIMEZONE));
  }, [product?.id, product?.published_at, product?.draft_data?.published_at]);

  useEffect(() => {
    const draft = product?.draft_data;
    const s = (draft?.status ?? product?.status) as string | undefined;
    const at = draft?.published_at ?? product?.published_at;
    if (s === "published" && at && new Date(at) > new Date()) setStatusDropdown("scheduled");
    else if (s === "pending_review" || s === "published" || s === "draft") setStatusDropdown(s as StatusDropdownValue);
    else setStatusDropdown("draft");
  }, [product?.id, product?.status, product?.published_at, product?.draft_data]);

  const handleStatusDropdownChange = useCallback(
    (value: StatusDropdownValue) => {
      setStatusDropdown(value);
      if (value === "scheduled") {
        const utc = publishDateLocal ? fromDatetimeLocalToUtc(publishDateLocal, PRODUCT_PUBLISH_TIMEZONE) : "";
        const isPastOrEmpty = !utc || new Date(utc) <= new Date();
        if (isPastOrEmpty) setPublishDateLocal(getDefaultScheduledTimeLocal(PRODUCT_PUBLISH_TIMEZONE));
      }
    },
    [publishDateLocal]
  );

  const applyTemplateSchema = useCallback(
    (template: ProductTemplate) => {
      const scoreLabels = Array.isArray(template.score_schema)
        ? template.score_schema.filter((s): s is string => typeof s === "string" && String(s).trim() !== "")
        : [];

      setSpecGroups((prev) =>
        initializeSpecs(prev, getTemplateSchemaAsGroups(template.spec_schema))
      );

      setSubScores((prev) => {
        const existingScores: Record<string, number> = {};
        for (const e of prev) {
          const L = e.label.trim();
          if (L) existingScores[L] = e.value;
        }
        const newSubScores: SubScoreEntry[] = scoreLabels.map((name) => ({
          label: String(name),
          value: existingScores[name] ?? 0,
        }));
        const templateLabelSet = new Set(scoreLabels);
        for (const e of prev) {
          const L = e.label.trim();
          if (L && !templateLabelSet.has(L)) {
            newSubScores.push({ label: e.label, value: e.value });
          }
        }
        return newSubScores;
      });
    },
    []
  );

  const handleTemplateChange = useCallback(
    (newTemplateId: string) => {
      setTemplateId(newTemplateId);
      const template = templates.find((t) => t.id === newTemplateId);
      if (template) applyTemplateSchema(template);
    },
    [templates, applyTemplateSchema]
  );

  // On load: when product has template_id, merge template's score_schema (and spec_schema) so UI has all keys
  useEffect(() => {
    const template = templates.find((t) => t.id === templateId);
    if (templateId && template) {
      applyTemplateSchema(template);
    }
  }, [templateId, templates, applyTemplateSchema]);

  useEffect(() => {
    setSelectedTags(initialProductTags);
  }, [initialProductTags]);

  useEffect(() => {
    const nextSlug = slugify(name);
    if (nextSlug && (!slug.trim() || !slugManuallyEdited)) {
      setSlug(nextSlug);
    }
  }, [name, slugManuallyEdited]);

  const syncSlugFromName = useCallback(() => {
    setSlug(slugify(name));
    setSlugManuallyEdited(false);
  }, [name]);

  const updateSpecValue = useCallback((groupName: string, specName: string, value: string) => {
    setSpecGroups((prev) => ({
      ...prev,
      [groupName]: {
        ...prev[groupName],
        [specName]: value,
      },
    }));
  }, []);

  const updateVariantMatrix = useCallback(
    (groupName: string, specName: string, index: number, field: "value1" | "value2", value: string) => {
      setSpecGroups((prev) => {
        const group = prev[groupName] ?? {};
        const raw = group[specName];
        const arr = Array.isArray(raw)
          ? (raw as VariantMatrixEntry[]).map((x) => ({ value1: x.value1 ?? "", value2: x.value2 ?? "" }))
          : [{ value1: "", value2: "" }];
        const next = [...arr];
        if (index >= 0 && index < next.length) {
          next[index] = { ...next[index], [field]: value };
        }
        return {
          ...prev,
          [groupName]: { ...group, [specName]: next },
        };
      });
    },
    []
  );

  const addVariantMatrixRow = useCallback((groupName: string, specName: string) => {
    setSpecGroups((prev) => {
      const group = prev[groupName] ?? {};
      const raw = group[specName];
      const arr = Array.isArray(raw)
        ? [...(raw as VariantMatrixEntry[]), { value1: "", value2: "" }]
        : [{ value1: "", value2: "" }];
      return { ...prev, [groupName]: { ...group, [specName]: arr } };
    });
  }, []);

  const removeVariantMatrixRow = useCallback((groupName: string, specName: string, index: number) => {
    setSpecGroups((prev) => {
      const group = prev[groupName] ?? {};
      const raw = group[specName];
      const arr = Array.isArray(raw) ? (raw as VariantMatrixEntry[]) : [];
      const next = arr.filter((_, i) => i !== index);
      return {
        ...prev,
        [groupName]: { ...group, [specName]: next.length > 0 ? next : [{ value1: "", value2: "" }] },
      };
    });
  }, []);

  const updateIpRating = useCallback(
    (groupName: string, specName: string, index: number, field: "dust" | "water", value: string) => {
      setSpecGroups((prev) => {
        const group = prev[groupName] ?? {};
        const raw = group[specName];
        const arr = Array.isArray(raw) && raw[0] != null && "dust" in raw[0]
          ? (raw as IpRatingEntry[]).map((x) => ({ dust: x.dust ?? "X", water: x.water ?? "X" }))
          : [{ dust: "X", water: "X" }];
        const next = [...arr];
        if (index >= 0 && index < next.length) next[index] = { ...next[index], [field]: value };
        return { ...prev, [groupName]: { ...group, [specName]: next } };
      });
    },
    []
  );

  const addIpRatingRow = useCallback((groupName: string, specName: string) => {
    setSpecGroups((prev) => {
      const group = prev[groupName] ?? {};
      const raw = group[specName];
      const arr = Array.isArray(raw) && raw[0] != null && "dust" in raw[0]
        ? [...(raw as IpRatingEntry[]), { dust: "X", water: "X" }]
        : [{ dust: "X", water: "X" }];
      return { ...prev, [groupName]: { ...group, [specName]: arr } };
    });
  }, []);

  const removeIpRatingRow = useCallback((groupName: string, specName: string, index: number) => {
    setSpecGroups((prev) => {
      const group = prev[groupName] ?? {};
      const raw = group[specName];
      const arr = Array.isArray(raw) && raw[0] != null && "dust" in raw[0] ? (raw as IpRatingEntry[]) : [];
      const next = arr.filter((_, i) => i !== index);
      return {
        ...prev,
        [groupName]: { ...group, [specName]: next.length > 0 ? next : [{ dust: "X", water: "X" }] },
      };
    });
  }, []);

  const updateBooleanSpec = useCallback(
    (groupName: string, specName: string, update: Partial<BooleanWithDetails>) => {
      setSpecGroups((prev) => {
        const group = prev[groupName] ?? {};
        const raw = group[specName];
        const current: BooleanWithDetails =
          raw && typeof raw === "object" && !Array.isArray(raw) && "value" in raw
            ? { value: Boolean((raw as BooleanWithDetails).value), details: String((raw as BooleanWithDetails).details ?? "") }
            : { value: false, details: "" };
        return {
          ...prev,
          [groupName]: {
            ...group,
            [specName]: {
              value: update.value !== undefined ? update.value : current.value,
              details: update.details !== undefined ? update.details : current.details,
            },
          },
        };
      });
    },
    []
  );

  const updateCameraLens = useCallback(
    (groupName: string, specName: string, field: keyof CameraLensData, value: string | boolean) => {
      setSpecGroups((prev) => {
        const group = prev[groupName] ?? {};
        const raw = group[specName];
        const current: CameraLensData = isCameraLensData(raw)
          ? { ...DEFAULT_CAMERA_LENS, ...raw }
          : { ...DEFAULT_CAMERA_LENS };
        return {
          ...prev,
          [groupName]: { ...group, [specName]: { ...current, [field]: value } },
        };
      });
    },
    []
  );

  const updateDisplayPanel = useCallback(
    (groupName: string, specName: string, field: keyof DisplayPanelData, value: string | boolean) => {
      setSpecGroups((prev) => {
        const group = prev[groupName] ?? {};
        const raw = group[specName];
        const current: DisplayPanelData = isDisplayPanelData(raw)
          ? { ...DEFAULT_DISPLAY_PANEL, ...raw }
          : { ...DEFAULT_DISPLAY_PANEL };
        return {
          ...prev,
          [groupName]: { ...group, [specName]: { ...current, [field]: value } },
        };
      });
    },
    []
  );

  const addPro = useCallback(() => setPros((prev) => [...prev, ""]), []);
  const updatePro = useCallback((index: number, value: string) => {
    setPros((prev) => prev.map((v, i) => (i === index ? value : v)));
  }, []);
  const removePro = useCallback((index: number) => {
    setPros((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const addCon = useCallback(() => setCons((prev) => [...prev, ""]), []);
  const updateCon = useCallback((index: number, value: string) => {
    setCons((prev) => prev.map((v, i) => (i === index ? value : v)));
  }, []);
  const removeCon = useCallback((index: number) => {
    setCons((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const updateSubScore = useCallback((index: number, value: number) => {
    setSubScores((prev) =>
      prev.map((e, i) => (i === index ? { ...e, value } : e))
    );
  }, []);

  const addSubScore = useCallback(() => {
    setSubScores((prev) => [...prev, { label: "", value: 0 }]);
  }, []);

  const updateSubScoreLabel = useCallback((index: number, label: string) => {
    setSubScores((prev) =>
      prev.map((e, i) => (i === index ? { ...e, label } : e))
    );
  }, []);

  const removeSubScore = useCallback((index: number) => {
    setSubScores((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const addAffiliateLink = useCallback(() => {
    if (affiliateLinks.length >= 5) return;
    setAffiliateLinks((prev) => [...prev, { retailer: "", url: "", price_amount: "", price_currency: DEFAULT_CURRENCY_CODE }]);
  }, [affiliateLinks.length]);

  const updateAffiliateLink = useCallback((index: number, field: keyof AffiliateLink, value: string) => {
    setAffiliateLinks((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }, []);

  const removeAffiliateLink = useCallback((index: number) => {
    setAffiliateLinks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const editorialData: EditorialData = {
    bottom_line: bottomLine.trim() || undefined,
    pros: pros.filter((p) => p.trim()).length ? pros.map((p) => p.trim()).filter(Boolean) : undefined,
    cons: cons.filter((c) => c.trim()).length ? cons.map((c) => c.trim()).filter(Boolean) : undefined,
    buy_if: (() => {
      const lines = buyIfText.split(/\n/).map((s) => s.trim()).filter(Boolean);
      return lines.length ? lines : undefined;
    })(),
    dont_buy_if: (() => {
      const lines = dontBuyIfText.split(/\n/).map((s) => s.trim()).filter(Boolean);
      return lines.length ? lines : undefined;
    })(),
    sub_scores: (() => {
      const finalSubScores = subScores.reduce<Record<string, number>>((acc, curr) => {
        const L = curr.label?.trim();
        if (L) acc[L] = curr.value;
        return acc;
      }, {});
      return Object.keys(finalSubScores).length ? finalSubScores : undefined;
    })(),
    final_score: finalScore || undefined,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!templateId.trim()) {
      setError("Please select a product blueprint to continue.");
      return;
    }
    setError("");
    setSaving(true);
    const linksPayload: AffiliateLink[] = affiliateLinks
      .map((item) => ({
        retailer: item.retailer?.trim() ?? "",
        url: item.url?.trim() ?? "",
        price: item.price?.trim() || undefined,
        price_amount: item.price_amount?.trim() || undefined,
        price_currency: item.price_currency?.trim() || DEFAULT_CURRENCY_CODE,
      }))
      .filter((item) => item.retailer || item.url);

    let resolvedBrandId: string | null = brandId?.trim() || null;
    if (resolvedBrandId === "__new__") {
      if (!newBrandName.trim()) {
        setError("Enter a name for the new brand.");
        setSaving(false);
        return;
      }
    }
    if (resolvedBrandId === "__new__" && newBrandName.trim()) {
      const { brand: created, error: createErr } = await createBrand(newBrandName.trim());
      if (createErr || !created) {
        setError(createErr ?? "Failed to create brand.");
        setSaving(false);
        return;
      }
      resolvedBrandId = created.id;
    }

    const newTags = selectedTags.filter((t) => t.isNew);
    const existingTagIds = selectedTags.filter((t) => !t.isNew).map((t) => t.id);
    const createdTagIds: number[] = [];
    for (const t of newTags) {
      const fd = new FormData();
      fd.set("name", t.name ?? "");
      const res = await createTag(fd);
      if (res.error) {
        setError(res.error ?? "Failed to create tag.");
        setSaving(false);
        return;
      }
      if (res.id != null) createdTagIds.push(res.id);
    }
    const tag_ids = [...existingTagIds, ...createdTagIds];

    const payload: Partial<Product> & { tag_ids?: number[] } = {
      ...(product?.id ? { id: product.id } : {}),
      name: name.trim(),
      brand_id: resolvedBrandId,
      slug: slug.trim(),
      announcement_date: announcementDate.trim() || null,
      release_date: releaseDate.trim() || null,
      discontinued_date: discontinuedDate.trim() || null,
      software_updates_years: (() => {
        const n = Number(softwareUpdatesYears);
        return softwareUpdatesYears.trim() !== "" && !Number.isNaN(n) ? n : null;
      })(),
      security_updates_years: (() => {
        const n = Number(securityUpdatesYears);
        return securityUpdatesYears.trim() !== "" && !Number.isNaN(n) ? n : null;
      })(),
      hero_image: heroImage?.trim() || null,
      transparent_image: transparentImage?.trim() || null,
      template_id: templateId.trim() || null,
      category_id: categoryId === "" ? null : categoryId,
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null,
      award_id: awardId.trim() || null,
      specs: specGroups,
      affiliate_links: linksPayload,
      editorial_data: editorialData,
      status: (statusDropdown === "scheduled" ? "published" : statusDropdown) as "draft" | "published" | "pending_review",
      published_at: (() => {
        if (statusDropdown === "scheduled" && publishDateLocal) {
          const utc = fromDatetimeLocalToUtc(publishDateLocal, PRODUCT_PUBLISH_TIMEZONE);
          return utc || null;
        }
        if (statusDropdown === "published") {
          const utc = publishDateLocal ? fromDatetimeLocalToUtc(publishDateLocal, PRODUCT_PUBLISH_TIMEZONE) : null;
          if (utc && new Date(utc) > new Date()) return utc;
          return new Date().toISOString();
        }
        return product?.published_at ?? null;
      })(),
      tag_ids,
    };
    const result = await upsertProduct(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const wasDraftOrPending =
      product?.status === "draft" || product?.status === "pending_review";
    if (product && wasDraftOrPending) {
      toast.success("Draft Saved");
    } else if (product?.id) {
      toast.success("Product updated");
    }
    if (product?.id) {
      router.refresh();
      return;
    }
    if (onSuccess) {
      onSuccess();
    } else {
      router.push("/admin/products");
    }
  }

  const inputClass =
    "w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/50 focus:outline-none focus:ring-1 focus:ring-hot-white/30";
  const labelClass = "block font-sans text-sm font-medium text-gray-400 mb-1";
  const textareaClass = `${inputClass} min-h-[100px] resize-y`;

  const hasTemplate = Boolean(templateId.trim());

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {hasTemplate && (
        <div className="sticky top-0 z-[100] w-full bg-gray-900/95 backdrop-blur border-b border-white/10 h-[82px] flex flex-col pt-4 pb-2 px-6">
          {/* Row 1: Left = primary controls (Date, Status, Preview, Schedule/Publish); Right = Timeline, Update, Cancel */}
          <div className="flex items-center justify-between w-full min-h-[40px]">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="w-[200px]">
                  {product && (
                    <input
                      type="datetime-local"
                      value={publishDateLocal}
                      onChange={(e) => setPublishDateLocal(e.target.value)}
                      className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white focus:border-hot-white/50 focus:outline-none focus:ring-1 focus:ring-hot-white/30"
                      aria-label="Publish date"
                    />
                  )}
                </div>
                <div className="w-[140px]">
                  {product && (
                    <select
                      value={statusDropdown}
                      onChange={(e) => handleStatusDropdownChange(e.target.value as StatusDropdownValue)}
                      className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white focus:border-hot-white/50 focus:outline-none focus:ring-1 focus:ring-hot-white/30"
                      aria-label="Status"
                    >
                      <option value="draft">Draft</option>
                      <option value="pending_review">Pending Review</option>
                      <option value="published">Published</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  )}
                </div>
                {statusDropdown === "scheduled" && product && (() => {
                  const utc = publishDateLocal ? fromDatetimeLocalToUtc(publishDateLocal, PRODUCT_PUBLISH_TIMEZONE) : "";
                  const isPastOrEmpty = !utc || new Date(utc) <= new Date();
                  return isPastOrEmpty ? (
                    <span className="font-sans text-[10px] text-amber-400 leading-tight">Set a future date for Scheduled</span>
                  ) : null;
                })()}
              </div>
              <div className="flex items-center gap-4">
                {previewUrl && (
                  <Link
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/5 py-2 px-4 font-sans text-sm font-medium text-hot-white transition-colors hover:bg-white/10 shrink-0"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </Link>
                )}
                {product?.id && (
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={async () => {
                      if (!product?.id) return;
                      setPublishing(true);
                      setError("");
                      const utcIso = publishDateLocal
                        ? fromDatetimeLocalToUtc(publishDateLocal, PRODUCT_PUBLISH_TIMEZONE)
                        : undefined;
                      const result = await publishProductDraft(product.id, utcIso || undefined);
                      setPublishing(false);
                      if (result.error) {
                        setError(result.error);
                        return;
                      }
                      if (isScheduled && utcIso) {
                        toast.success(
                          `Scheduled for ${formatInTimeZone(new Date(utcIso), PRODUCT_PUBLISH_TIMEZONE, "MMM d, yyyy 'at' h:mm a zzz")}`
                        );
                      } else {
                        toast.success("Published");
                      }
                      router.refresh();
                    }}
                    className="flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50 shrink-0"
                  >
                    {publishing ? (isScheduled ? "Scheduling…" : "Publishing…") : isScheduled ? "Schedule" : "Publish"}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {product && (
                <div className="hidden sm:flex flex-col items-end gap-0.5 mr-2 shrink-0 min-w-[160px]">
                  <div className="flex items-center gap-1.5 font-sans text-xs text-gray-400">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
                    {(product.published_at ?? product.draft_data?.published_at)
                      ? formatInTimeZone(
                          new Date((product.published_at ?? product.draft_data?.published_at) as string),
                          PRODUCT_PUBLISH_TIMEZONE,
                          "MMM d, yyyy • HH:mm"
                        )
                      : "Not yet published"}
                  </div>
                  <div className="flex items-center gap-1.5 font-sans text-xs text-gray-500">
                    <Pencil className="h-3 w-3 shrink-0" />
                    {product.updated_at
                      ? differenceInHours(new Date(), new Date(product.updated_at)) < 48
                        ? `Saved ${formatDistanceToNow(new Date(product.updated_at), { addSuffix: true })}`
                        : formatInTimeZone(new Date(product.updated_at), PRODUCT_PUBLISH_TIMEZONE, "MMM d, yyyy • HH:mm")
                      : "—"}
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-hot-white px-4 py-2 font-sans text-sm font-medium text-hot-black transition-colors hover:bg-hot-white/90 disabled:opacity-50 shrink-0"
              >
                {saving ? "Saving…" : product ? "Update Product" : "Create Product"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/admin/products")}
                className="rounded-md border border-white/20 px-4 py-2 font-sans text-sm text-gray-400 bg-white/5 hover:bg-white/10 hover:text-hot-white shrink-0"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Row 2: Static Labels — directly beneath inputs, fixed height so they don't push Row 1 */}
          {product && (
            <div className="flex gap-4 mt-1 h-[14px] items-center">
              <span className="text-[10px] text-gray-500 w-[200px] pl-1 shrink-0">Publish Date (EST)</span>
              <span className="text-[10px] text-gray-500 w-[140px] shrink-0">Status</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left column: Template (always), then Basic Info, SEO, Media when template selected */}
        <div className="space-y-8 lg:col-span-5">
          <section className="space-y-4">
            <h2 className="font-sans text-lg font-medium text-hot-white">
              Blueprint
            </h2>
            <div>
              <label className={labelClass}>Product template (required)</label>
              <select
                value={templateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className={inputClass}
                aria-label="Product template"
                required
              >
                <option value="">Select a blueprint…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {!hasTemplate ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-6 text-center">
              <p className="font-sans text-sm text-amber-200">
                Please select a product blueprint to continue.
              </p>
            </div>
          ) : (
            <>
              <section className="space-y-4">
                <h2 className="font-sans text-lg font-medium text-hot-white">
                  Basic info
                </h2>
                {product && (() => {
                  const at = product.draft_data?.published_at ?? product.published_at;
                  const isScheduledRelease =
                    (product.draft_data?.status ?? product.status) === "published" &&
                    at &&
                    new Date(at) > new Date();
                  if (!isScheduledRelease) return null;
                  const formatted = at
                    ? formatInTimeZone(new Date(at), PRODUCT_PUBLISH_TIMEZONE, "MMM d, yyyy 'at' h:mm a zzz")
                    : "";
                  return (
                    <div className="rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-2 font-sans text-sm text-blue-200">
                      Scheduled for {formatted}
                    </div>
                  );
                })()}
                <div>
                  <label className={labelClass}>Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="Product name"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Brand</label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className={inputClass}
                    required
                    aria-label="Brand"
                  >
                    <option value="">Select brand</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                    <option value="__new__">➕ New brand...</option>
                  </select>
                  {brandId === "__new__" && (
                    <input
                      type="text"
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      className={`${inputClass} mt-2`}
                      placeholder="New brand name"
                      aria-label="New brand name"
                    />
                  )}
                </div>
                <div>
                  <label className={labelClass}>Slug</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value);
                        setSlugManuallyEdited(true);
                      }}
                      className={inputClass}
                      placeholder="url-slug"
                      required
                    />
                    <button
                      type="button"
                      onClick={syncSlugFromName}
                      className="shrink-0 rounded border border-white/10 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-hot-white"
                      title="Re-sync slug from name"
                      aria-label="Re-sync slug from name"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Announcement Date</label>
                    <input
                      type="date"
                      value={announcementDate}
                      onChange={(e) => setAnnouncementDate(e.target.value)}
                      className={inputClass}
                      aria-label="Announcement date"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Release Date</label>
                    <input
                      type="date"
                      value={releaseDate}
                      onChange={(e) => setReleaseDate(e.target.value)}
                      className={inputClass}
                      aria-label="Release date"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Discontinued Date</label>
                    <input
                      type="date"
                      value={discontinuedDate}
                      onChange={(e) => setDiscontinuedDate(e.target.value)}
                      className={inputClass}
                      aria-label="Discontinued date"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Software Updates (Years)</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={softwareUpdatesYears}
                      onChange={(e) => setSoftwareUpdatesYears(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 5"
                      aria-label="Software updates years"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Security Updates (Years)</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={securityUpdatesYears}
                      onChange={(e) => setSecurityUpdatesYears(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 7"
                      aria-label="Security updates years"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Category</label>
                  <select
                    value={categoryId === "" ? "" : String(categoryId)}
                    onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
                    className={inputClass}
                    aria-label="Product category"
                  >
                    <option value="">None</option>
                    {categoryOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Tags</label>
                  <TagInput
                    availableTags={availableTagOptions}
                    selectedTags={selectedTags}
                    onChange={setSelectedTags}
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="font-sans text-lg font-medium text-hot-white">
                  SEO metadata
                </h2>
                <div>
                  <label className={labelClass}>SEO Title</label>
                  <input
                    type="text"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    className={inputClass}
                    placeholder="Optional meta title"
                  />
                </div>
                <div>
                  <label className={labelClass}>SEO Description</label>
                  <input
                    type="text"
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    className={inputClass}
                    placeholder="Optional meta description"
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="font-sans text-lg font-medium text-hot-white">
                  Award
                </h2>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAwardSearchOpen((o) => !o)}
                    className="flex w-full items-center justify-between rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/50 focus:outline-none"
                  >
                    <span className={awardId ? "" : "text-gray-500"}>
                      {awardId
                        ? awards.find((a) => a.id === awardId)?.name ?? "—"
                        : "None"}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                  </button>
                  {awardSearchOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        aria-hidden
                        onClick={() => setAwardSearchOpen(false)}
                      />
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-hidden rounded-md border border-white/10 bg-hot-gray shadow-lg">
                        <input
                          type="text"
                          value={awardSearchQuery}
                          onChange={(e) => setAwardSearchQuery(e.target.value)}
                          placeholder="Search awards…"
                          className="w-full border-b border-white/10 bg-transparent px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:outline-none"
                          autoFocus
                        />
                        <ul className="max-h-36 overflow-y-auto py-1">
                          <li>
                            <button
                              type="button"
                              onClick={() => {
                                setAwardId("");
                                setAwardSearchOpen(false);
                                setAwardSearchQuery("");
                              }}
                              className="w-full px-3 py-2 text-left font-sans text-sm text-gray-400 hover:bg-white/10 hover:text-hot-white"
                            >
                              None
                            </button>
                          </li>
                          {awards
                            .filter(
                              (a) =>
                                !awardSearchQuery.trim() ||
                                a.name.toLowerCase().includes(awardSearchQuery.toLowerCase()) ||
                                a.slug.toLowerCase().includes(awardSearchQuery.toLowerCase())
                            )
                            .map((a) => (
                              <li key={a.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAwardId(a.id);
                                    setAwardSearchOpen(false);
                                    setAwardSearchQuery("");
                                  }}
                                  className="w-full px-3 py-2 text-left font-sans text-sm text-hot-white hover:bg-white/10"
                                >
                                  {a.name}
                                </button>
                              </li>
                            ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="font-sans text-lg font-medium text-hot-white">
                  Media
                </h2>
                <UniversalImagePicker
                  label="Hero Image"
                  value={heroImage}
                  onChange={(url) => setHeroImage(url || null)}
                />
                <UniversalImagePicker
                  label="Transparent Image"
                  value={transparentImage}
                  onChange={(url) => setTransparentImage(url || null)}
                />
              </section>
            </>
          )}
        </div>

        {/* Right column: Editorial Data -> Rating -> Where to Buy -> Specs */}
        {hasTemplate && (
          <div className="space-y-8 lg:col-span-7">
            <section className="space-y-4">
              <h2 className="font-sans text-lg font-medium text-hot-white">
                Editorial data
              </h2>
              <div>
                <label className={labelClass}>Product Bottom Line</label>
                <textarea
                  value={bottomLine}
                  onChange={(e) => setBottomLine(e.target.value)}
                  className={textareaClass}
                  placeholder="Short summary or verdict…"
                  rows={3}
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className={labelClass}>Pros</label>
                  <button
                    type="button"
                    onClick={addPro}
                    className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 font-sans text-sm text-gray-400 hover:bg-white/10 hover:text-hot-white"
                  >
                    Add Pro
                  </button>
                </div>
                <div className="space-y-2">
                  {pros.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={p}
                        onChange={(e) => updatePro(i, e.target.value)}
                        className={inputClass}
                        placeholder="Pro item"
                      />
                      <button
                        type="button"
                        onClick={() => removePro(i)}
                        className="shrink-0 rounded px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
                        aria-label="Remove pro"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className={labelClass}>Cons</label>
                  <button
                    type="button"
                    onClick={addCon}
                    className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 font-sans text-sm text-gray-400 hover:bg-white/10 hover:text-hot-white"
                  >
                    Add Con
                  </button>
                </div>
                <div className="space-y-2">
                  {cons.map((c, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={c}
                        onChange={(e) => updateCon(i, e.target.value)}
                        className={inputClass}
                        placeholder="Con item"
                      />
                      <button
                        type="button"
                        onClick={() => removeCon(i)}
                        className="shrink-0 rounded px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
                        aria-label="Remove con"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 p-4 space-y-4">
                <h3 className="font-sans text-sm font-medium text-hot-white">
                  Buying Advice (Global Defaults)
                </h3>
                <p className="text-xs text-gray-500">
                  Global default reasons to buy or avoid this product. One per line.
                </p>
                <div>
                  <label className={labelClass}>Buy If</label>
                  <textarea
                    value={buyIfText}
                    onChange={(e) => setBuyIfText(e.target.value)}
                    className={textareaClass}
                    placeholder="e.g. You want the best battery life&#10;You need a large display"
                    rows={3}
                  />
                </div>
                <div>
                  <label className={labelClass}>Don&apos;t Buy If</label>
                  <textarea
                    value={dontBuyIfText}
                    onChange={(e) => setDontBuyIfText(e.target.value)}
                    className={textareaClass}
                    placeholder="e.g. You need a headphone jack&#10;Budget is under $500"
                    rows={3}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="font-sans text-lg font-medium text-hot-white">
                Rating
              </h2>
              <p className="text-sm text-gray-500">
                Sub-scores from the template plus any custom scores.
              </p>
              <div className="space-y-2 w-full">
                {subScores.map((item, i) => (
                  <div key={i} className="flex w-full items-center gap-2">
                    <input
                      type="text"
                      value={item.label ?? ""}
                      onChange={(e) => updateSubScoreLabel(i, e.target.value)}
                      className={`${inputClass} min-w-[10rem] flex-1`}
                      placeholder="e.g. Performance"
                      aria-label="Sub-score label"
                    />
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={item.value}
                      onChange={(e) => updateSubScore(i, Number(e.target.value))}
                      className={`${inputClass} !w-20 shrink-0 text-center`}
                    />
                    <button
                      type="button"
                      onClick={() => removeSubScore(i)}
                      className="shrink-0 rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                      aria-label="Remove sub-score"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSubScore}
                  className="rounded-md border border-dashed border-white/20 px-3 py-1.5 font-sans text-sm text-gray-400 hover:border-white/40 hover:text-hot-white"
                >
                  Add sub-score
                </button>
              </div>
              <div>
                <label className={labelClass}>Final score</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={finalScore}
                  onChange={(e) => setFinalScore(Number(e.target.value))}
                  className={`${inputClass} w-24`}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-sans text-lg font-medium text-hot-white">
                  Where to Buy
                </h2>
                {affiliateLinks.length < 5 && (
                  <button
                    type="button"
                    onClick={addAffiliateLink}
                    className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 font-sans text-sm text-gray-400 hover:bg-white/10 hover:text-hot-white"
                  >
                    Add Link
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Up to 5 retailer links (e.g. Amazon, store URL).
              </p>
              <div className="space-y-3">
                {affiliateLinks.map((link, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 w-full rounded border border-white/10 bg-white/5 p-2">
                    <input
                      type="text"
                      value={link.retailer ?? ""}
                      onChange={(e) => updateAffiliateLink(i, "retailer", e.target.value)}
                      className={`${inputClass} col-span-3 w-full`}
                      placeholder="Retailer (e.g. Amazon)"
                    />
                    <input
                      type="url"
                      value={link.url ?? ""}
                      onChange={(e) => updateAffiliateLink(i, "url", e.target.value)}
                      className={`${inputClass} col-span-5 w-full`}
                      placeholder="URL"
                    />
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={link.price_amount ?? ""}
                        onChange={(e) => updateAffiliateLink(i, "price_amount", e.target.value)}
                        className={`${inputClass} w-full`}
                        placeholder="Price (e.g. 49.99)"
                      />
                    </div>
                    <select
                      value={link.price_currency || DEFAULT_CURRENCY_CODE}
                      onChange={(e) => updateAffiliateLink(i, "price_currency", e.target.value)}
                      className={`${inputClass} col-span-2 w-full`}
                      title="Currency"
                      aria-label="Currency"
                    >
                      {CURRENCY_OPTIONS.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.symbol}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeAffiliateLink(i)}
                      className="col-span-12 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10 w-fit"
                      aria-label="Remove link"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="font-sans text-lg font-medium text-hot-white">
                Specs
              </h2>
              {(() => {
                const schemaGroups = getTemplateSchemaAsGroups(selectedTemplate?.spec_schema);
                if (schemaGroups.length === 0) return null;
                return (
                  <div className="space-y-4">
                    {schemaGroups.map((group, idx) => (
                      <details
                        key={group.id || group.groupName}
                        className="group mb-4 bg-white/5 border border-white/10 rounded-xl overflow-hidden"
                        open={idx === 0}
                      >
                        <summary className="p-4 font-bold cursor-pointer bg-white/5 hover:bg-white/10 list-none flex justify-between items-center">
                          {group.groupName || "General"}
                          <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {(group.specs ?? []).map((spec) => {
                            const groupName = group.groupName?.trim() || "General";
                            const specName = spec.name?.trim();
                            if (!specName) return null;
                            const specType = (spec as SpecItem).type ?? "text";
                            if (specType === "variant_matrix") {
                              const raw = specGroups[groupName]?.[specName];
                              const entries: VariantMatrixEntry[] = Array.isArray(raw)
                                ? (raw as VariantMatrixEntry[]).map((x) => ({
                                    value1: typeof x?.value1 === "string" ? x.value1 : "",
                                    value2: typeof x?.value2 === "string" ? x.value2 : "",
                                  }))
                                : [{ value1: "", value2: "" }];
                              const col1Label = (spec as SpecItem).matrixConfig?.col1Label || "Value 1";
                              const col2Label = (spec as SpecItem).matrixConfig?.col2Label || "Value 2";
                              return (
                                <div key={spec.id || specName} className="md:col-span-2 space-y-2">
                                  <label className={labelClass}>{specName}</label>
                                  <div className="space-y-2">
                                    {entries.map((entry, idx) => (
                                      <div
                                        key={idx}
                                        className="grid grid-cols-12 gap-2 items-center rounded border border-white/10 bg-white/5 p-2"
                                      >
                                        <input
                                          type="text"
                                          value={entry.value1}
                                          onChange={(e) =>
                                            updateVariantMatrix(groupName, specName, idx, "value1", e.target.value)
                                          }
                                          className={`${inputClass} col-span-5`}
                                          placeholder={col1Label}
                                        />
                                        <input
                                          type="text"
                                          value={entry.value2}
                                          onChange={(e) =>
                                            updateVariantMatrix(groupName, specName, idx, "value2", e.target.value)
                                          }
                                          className={`${inputClass} col-span-5`}
                                          placeholder={col2Label}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removeVariantMatrixRow(groupName, specName, idx)}
                                          className="col-span-2 rounded px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
                                          aria-label="Remove configuration"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => addVariantMatrixRow(groupName, specName)}
                                      className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 font-sans text-sm text-gray-400 hover:bg-white/10 hover:text-hot-white"
                                    >
                                      + Add Configuration
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                            if (specType === "ip_rating") {
                              const raw = specGroups[groupName]?.[specName];
                              const entries: IpRatingEntry[] =
                                Array.isArray(raw) && raw[0] != null && "dust" in raw[0]
                                  ? (raw as IpRatingEntry[]).map((x) => ({ dust: x.dust ?? "X", water: x.water ?? "X" }))
                                  : [{ dust: "X", water: "X" }];
                              const DUST_OPTIONS = [
                                { value: "X", label: "X (Not tested/No rating)" },
                                ...["0", "1", "2", "3", "4", "5", "6"].map((v) => ({ value: v, label: v })),
                              ];
                              const WATER_OPTIONS = [
                                { value: "X", label: "X (Not tested)" },
                                ...["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((v) => ({ value: v, label: v })),
                              ];
                              return (
                                <div key={spec.id || specName} className="md:col-span-2 space-y-2">
                                  <label className={labelClass}>{specName}</label>
                                  <div className="space-y-2">
                                    {entries.map((entry, idx) => (
                                      <div
                                        key={idx}
                                        className="grid grid-cols-12 gap-2 items-center rounded border border-white/10 bg-white/5 p-2"
                                      >
                                        <div className="col-span-5">
                                          <label className="text-xs text-gray-500 block mb-0.5">Dust</label>
                                          <select
                                            value={entry.dust}
                                            onChange={(e) => updateIpRating(groupName, specName, idx, "dust", e.target.value)}
                                            className={inputClass}
                                            aria-label="Dust rating"
                                          >
                                            {DUST_OPTIONS.map((opt) => (
                                              <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="col-span-5">
                                          <label className="text-xs text-gray-500 block mb-0.5">Water</label>
                                          <select
                                            value={entry.water}
                                            onChange={(e) => updateIpRating(groupName, specName, idx, "water", e.target.value)}
                                            className={inputClass}
                                            aria-label="Water rating"
                                          >
                                            {WATER_OPTIONS.map((opt) => (
                                              <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="col-span-2 flex items-end">
                                          <button
                                            type="button"
                                            onClick={() => removeIpRatingRow(groupName, specName, idx)}
                                            disabled={entries.length <= 1}
                                            className="rounded px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                                            aria-label="Remove IP rating"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => addIpRatingRow(groupName, specName)}
                                      className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 font-sans text-sm text-gray-400 hover:bg-white/10 hover:text-hot-white"
                                    >
                                      + Add IP Rating
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                            if (specType === "boolean") {
                              const raw = specGroups[groupName]?.[specName];
                              const boolVal: BooleanWithDetails =
                                raw && typeof raw === "object" && !Array.isArray(raw) && "value" in raw
                                  ? {
                                      value: Boolean((raw as BooleanWithDetails).value),
                                      details: String((raw as BooleanWithDetails).details ?? ""),
                                    }
                                  : { value: false, details: "" };
                              return (
                                <div key={spec.id || specName} className="flex flex-col gap-2">
                                  <label className={labelClass}>{specName}</label>
                                  <div className="flex flex-wrap items-center gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={boolVal.value}
                                        onChange={(e) =>
                                          updateBooleanSpec(groupName, specName, { value: e.target.checked })
                                        }
                                        className="rounded border-white/20"
                                      />
                                      <span className="text-sm text-gray-400">Yes / No</span>
                                    </label>
                                    {boolVal.value && (
                                      <input
                                        type="text"
                                        value={boolVal.details}
                                        onChange={(e) =>
                                          updateBooleanSpec(groupName, specName, { details: e.target.value })
                                        }
                                        className={inputClass}
                                        placeholder="Optional details (e.g., 15W Qi2)"
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            if (specType === "camera_lens") {
                              const raw = specGroups[groupName]?.[specName];
                              const lens: CameraLensData = isCameraLensData(raw)
                                ? { ...DEFAULT_CAMERA_LENS, ...raw }
                                : { ...DEFAULT_CAMERA_LENS };
                              const input = (key: keyof Omit<CameraLensData, "ois">, placeholder: string) => (
                                <input
                                  type="text"
                                  value={lens[key]}
                                  onChange={(e) => updateCameraLens(groupName, specName, key, e.target.value)}
                                  className={inputClass}
                                  placeholder={placeholder}
                                />
                              );
                              return (
                                <div key={spec.id || specName} className="md:col-span-2">
                                  <label className={labelClass}>{specName}</label>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-white/5 rounded-lg border border-white/10 mt-2">
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">MP</label>
                                      {input("mp", "e.g. 50")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Aperture</label>
                                      {input("aperture", "e.g. f/1.8")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Focal length</label>
                                      {input("focalLength", "e.g. 24mm")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Field of View (FoV)</label>
                                      {input("fov", "e.g. 120°")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Lens type</label>
                                      {input("lensType", "e.g. Wide")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Sensor size</label>
                                      {input("sensorSize", "e.g. 1/1.28&quot;")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Pixel size</label>
                                      {input("pixelSize", "e.g. 1.22µm")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Autofocus</label>
                                      {input("autofocus", "e.g. PDAF")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Zoom</label>
                                      {input("zoom", "e.g. 2x")}
                                    </div>
                                    <div className="flex items-end">
                                      <label className="flex items-center gap-2 cursor-pointer pb-2">
                                        <input
                                          type="checkbox"
                                          checked={lens.ois}
                                          onChange={(e) => updateCameraLens(groupName, specName, "ois", e.target.checked)}
                                          className="rounded border-white/20"
                                        />
                                        <span className="text-sm text-gray-400">Optical Image Stabilization (OIS)</span>
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            if (specType === "display_panel") {
                              const raw = specGroups[groupName]?.[specName];
                              const panel: DisplayPanelData = isDisplayPanelData(raw)
                                ? { ...DEFAULT_DISPLAY_PANEL, ...raw }
                                : { ...DEFAULT_DISPLAY_PANEL };
                              const text = (key: keyof Omit<DisplayPanelData, "hasDolbyVision" | "hasHDR10Plus">, placeholder: string) => (
                                <input
                                  type="text"
                                  value={panel[key]}
                                  onChange={(e) => updateDisplayPanel(groupName, specName, key, e.target.value)}
                                  className={inputClass}
                                  placeholder={placeholder}
                                />
                              );
                              return (
                                <div key={spec.id || specName} className="md:col-span-2">
                                  <label className={labelClass}>{specName}</label>
                                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 p-4 bg-white/5 rounded-lg border border-white/10 mt-2">
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Display name</label>
                                      {text("displayName", "e.g. Primary")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Diagonal size</label>
                                      {text("diagonalSize", "e.g. 6.7")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Screen-to-body ratio</label>
                                      {text("screenToBodyRatio", "e.g. 89%")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Panel type</label>
                                      {text("panelType", "e.g. AMOLED")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Color depth</label>
                                      <select
                                        value={panel.colorDepth}
                                        onChange={(e) => updateDisplayPanel(groupName, specName, "colorDepth", e.target.value)}
                                        className={inputClass}
                                        aria-label="Color depth"
                                      >
                                        <option value="">Color Depth (Unknown)</option>
                                        <option value="8-bit">8-bit (16M colors)</option>
                                        <option value="10-bit">10-bit (1B colors)</option>
                                        <option value="12-bit">12-bit (68B colors)</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Resolution</label>
                                      {text("resolution", "e.g. 1440×3200")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Aspect ratio</label>
                                      {text("aspectRatio", "e.g. 20:9")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Pixel density</label>
                                      {text("pixelDensity", "e.g. 526")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Refresh rate</label>
                                      {text("refreshRate", "e.g. 120")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">PWM</label>
                                      {text("pwm", "e.g. 2160")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">HBM brightness</label>
                                      {text("hbmBrightness", "e.g. 1600")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Peak brightness</label>
                                      {text("peakBrightness", "e.g. 2600")}
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Protection</label>
                                      {text("protection", "e.g. Gorilla Glass Victus")}
                                    </div>
                                    <div className="flex items-end gap-4">
                                      <label className="flex items-center gap-2 cursor-pointer pb-2">
                                        <input
                                          type="checkbox"
                                          checked={panel.hasDolbyVision}
                                          onChange={(e) => updateDisplayPanel(groupName, specName, "hasDolbyVision", e.target.checked)}
                                          className="rounded border-white/20"
                                        />
                                        <span className="text-sm text-gray-400">Dolby Vision</span>
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer pb-2">
                                        <input
                                          type="checkbox"
                                          checked={panel.hasHDR10Plus}
                                          onChange={(e) => updateDisplayPanel(groupName, specName, "hasHDR10Plus", e.target.checked)}
                                          className="rounded border-white/20"
                                        />
                                        <span className="text-sm text-gray-400">HDR10+</span>
                                      </label>
                                    </div>
                                    <div className="xl:col-span-2">
                                      <label className="text-xs text-gray-500 block mb-0.5">Other features</label>
                                      {text("otherFeatures", "e.g. LTPO, Always-on")}
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            const value = specGroups[groupName]?.[specName];
                            const textValue = typeof value === "string" ? value : "";
                            return (
                              <div key={spec.id || specName}>
                                <label className={labelClass}>{specName}</label>
                                <input
                                  type="text"
                                  value={textValue}
                                  onChange={(e) =>
                                    updateSpecValue(groupName, specName, e.target.value)
                                  }
                                  className={inputClass}
                                  placeholder={`e.g. ${specName}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    ))}
                  </div>
                );
              })()}
            </section>
          </div>
        )}
      </div>
    </form>
  );
}
