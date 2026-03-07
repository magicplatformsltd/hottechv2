"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { upsertProduct } from "@/lib/actions/product";
import type { Product, ProductSpecsNested, EditorialData, ProductTemplate, AffiliateLink, VariantMatrixEntry, BooleanWithDetails, CameraLensData } from "@/lib/types/product";
import type { ProductSpecsInput } from "@/lib/types/product";
import { getSpecLabelsFromSchema, getTemplateSchemaAsGroups } from "@/lib/types/template";
import type { SpecGroup, SpecItem } from "@/lib/types/template";
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY_CODE } from "@/lib/constants/currencies";
import type { ProductAwardRecord } from "@/lib/types/award";
import type { CategoryRow } from "@/lib/actions/categories";
import { UniversalImagePicker } from "@/app/components/admin/shared/UniversalImagePicker";
import { ChevronDown } from "lucide-react";

type ProductFormProps = {
  product: Product | null;
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
    brand: "",
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
  const flatFromNested: Record<string, string> = nested
    ? Object.values(nested).reduce(
        (acc, group) => {
          if (group && typeof group === "object")
            for (const [k, v] of Object.entries(group)) if (typeof v === "string") acc[k] = v;
          return acc;
        },
        {} as Record<string, string>
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
              value1: typeof (x as { value1?: string }).value1 === "string" ? (x as VariantMatrixEntry).value1 : typeof (x as { ram?: string }).ram === "string" ? (x as { ram: string }).ram : "",
              value2: typeof (x as { value2?: string }).value2 === "string" ? (x as VariantMatrixEntry).value2 : typeof (x as { storage?: string }).storage === "string" ? (x as { storage: string }).storage : "",
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

export function ProductForm({ product, templates = [], categories = [], awards = [], onSuccess }: ProductFormProps) {
  const router = useRouter();
  const initial = product ?? emptyProduct();

  const categoryOptions = useMemo(() => buildCategoryTreeOptions(categories), [categories]);

  const [templateId, setTemplateId] = useState<string | "">(
    initial.template_id ?? ""
  );
  const [categoryId, setCategoryId] = useState<number | "">(
    initial.category_id != null ? initial.category_id : ""
  );
  const [name, setName] = useState(initial.name ?? "");
  const [brand, setBrand] = useState(initial.brand ?? "");
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
  const [seoTitle, setSeoTitle] = useState(initial.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(initial.seo_description ?? "");
  const [awardId, setAwardId] = useState<string | "">(initial.award_id ?? "");
  const [awardSearchOpen, setAwardSearchOpen] = useState(false);
  const [awardSearchQuery, setAwardSearchQuery] = useState("");
  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLink[]>(() =>
    normalizeAffiliateLinks(initial.affiliate_links)
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
  const [error, setError] = useState("");

  const selectedTemplate = templates.find((t) => t.id === templateId);

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

    const payload: Partial<Product> = {
      ...(product?.id ? { id: product.id } : {}),
      name: name.trim(),
      brand: brand.trim(),
      slug: slug.trim(),
      announcement_date: announcementDate.trim() || null,
      release_date: releaseDate.trim() || null,
      discontinued_date: discontinuedDate.trim() || null,
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
    };
    const result = await upsertProduct(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
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
        <div className="sticky top-0 z-50 flex justify-between items-center bg-gray-900/95 backdrop-blur py-4 border-b border-white/10 mb-8 px-4 -mx-4 rounded-b">
          <div />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-hot-white px-4 py-2 font-sans text-sm font-medium text-hot-black transition-colors hover:bg-hot-white/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : product ? "Update Product" : "Create Product"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/products")}
              className="rounded-md border border-white/20 px-4 py-2 font-sans text-sm text-gray-400 bg-white/5 hover:bg-white/10 hover:text-hot-white"
            >
              Cancel
            </button>
          </div>
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
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className={inputClass}
                    placeholder="Brand"
                    required
                  />
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
