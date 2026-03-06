"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { upsertProduct } from "@/lib/actions/product";
import type { Product, ProductSpecs, EditorialData } from "@/lib/types/product";
import { UniversalImagePicker } from "@/app/components/admin/shared/UniversalImagePicker";

const DEFAULT_SUB_SCORE_KEYS = [
  "Performance",
  "Value",
  "Design",
  "Battery",
  "Display",
  "Camera",
] as const;

type ProductFormProps = {
  product: Product | null;
};

type SpecEntry = { key: string; value: string };
type SubScoreEntry = { key: string; value: number };

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

function specsToEntries(specs: ProductSpecs): SpecEntry[] {
  const entries = Object.entries(specs ?? {}).map(([key, value]) => ({
    key,
    value: String(value ?? ""),
  }));
  return entries.length ? entries : [{ key: "", value: "" }];
}

function entriesToSpecs(entries: SpecEntry[]): ProductSpecs {
  const out: ProductSpecs = {};
  for (const { key, value } of entries) {
    const k = key.trim();
    if (k) out[k] = value.trim();
  }
  return out;
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const initial = product ?? emptyProduct();

  const [name, setName] = useState(initial.name ?? "");
  const [brand, setBrand] = useState(initial.brand ?? "");
  const [slug, setSlug] = useState(initial.slug ?? "");
  const [releaseDate, setReleaseDate] = useState(
    initial.release_date ? initial.release_date.slice(0, 10) : ""
  );
  const [heroImage, setHeroImage] = useState<string | null>(
    initial.hero_image ?? null
  );
  const [transparentImage, setTransparentImage] = useState<string | null>(
    initial.transparent_image ?? null
  );
  const [specEntries, setSpecEntries] = useState<SpecEntry[]>(() =>
    specsToEntries(initial.specs ?? {})
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
  const [subScores, setSubScores] = useState<SubScoreEntry[]>(() => {
    const ed = initial.editorial_data?.sub_scores;
    if (ed && Object.keys(ed).length > 0) {
      return Object.entries(ed).map(([key, value]) => ({
        key,
        value: Number(value) || 0,
      }));
    }
    return DEFAULT_SUB_SCORE_KEYS.map((key) => ({ key, value: 0 }));
  });
  const [finalScore, setFinalScore] = useState<number>(
    initial.editorial_data?.final_score ?? 0
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addSpec = useCallback(() => {
    setSpecEntries((prev) => [...prev, { key: "", value: "" }]);
  }, []);

  const updateSpec = useCallback((index: number, field: "key" | "value", value: string) => {
    setSpecEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  }, []);

  const removeSpec = useCallback((index: number) => {
    setSpecEntries((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

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
    setSubScores((prev) => [...prev, { key: "", value: 0 }]);
  }, []);

  const updateSubScoreKey = useCallback((index: number, key: string) => {
    setSubScores((prev) =>
      prev.map((e, i) => (i === index ? { ...e, key } : e))
    );
  }, []);

  const removeSubScore = useCallback((index: number) => {
    setSubScores((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const editorialData: EditorialData = {
    pros: pros.filter((p) => p.trim()).length ? pros.map((p) => p.trim()).filter(Boolean) : undefined,
    cons: cons.filter((c) => c.trim()).length ? cons.map((c) => c.trim()).filter(Boolean) : undefined,
    sub_scores: (() => {
      const rec: Record<string, number> = {};
      for (const { key, value } of subScores) {
        const k = key.trim();
        if (k) rec[k] = value;
      }
      return Object.keys(rec).length ? rec : undefined;
    })(),
    final_score: finalScore || undefined,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload: Partial<Product> = {
      ...(product?.id ? { id: product.id } : {}),
      name: name.trim(),
      brand: brand.trim(),
      slug: slug.trim(),
      release_date: releaseDate.trim() || null,
      hero_image: heroImage?.trim() || null,
      transparent_image: transparentImage?.trim() || null,
      specs: entriesToSpecs(specEntries),
      affiliate_links: product?.affiliate_links ?? {},
      editorial_data: editorialData,
    };
    const result = await upsertProduct(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/admin/products");
  }

  const inputClass =
    "w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/50 focus:outline-none focus:ring-1 focus:ring-hot-white/30";
  const labelClass = "block font-sans text-sm font-medium text-gray-400 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      {error && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

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
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
            placeholder="url-slug"
            required
          />
        </div>
        <div>
          <label className={labelClass}>Release Date</label>
          <input
            type="date"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            className={inputClass}
          />
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

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-lg font-medium text-hot-white">
            Specs
          </h2>
          <button
            type="button"
            onClick={addSpec}
            className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 font-sans text-sm text-gray-400 hover:bg-white/10 hover:text-hot-white"
          >
            Add Spec
          </button>
        </div>
        <div className="space-y-2">
          {specEntries.map((entry, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                value={entry.key}
                onChange={(e) => updateSpec(i, "key", e.target.value)}
                className={`${inputClass} flex-1`}
                placeholder="e.g. CPU"
              />
              <input
                type="text"
                value={entry.value}
                onChange={(e) => updateSpec(i, "value", e.target.value)}
                className={`${inputClass} flex-1`}
                placeholder="e.g. Snapdragon 8 Gen 3"
              />
              <button
                type="button"
                onClick={() => removeSpec(i)}
                className="shrink-0 rounded px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
                aria-label="Remove spec"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-sans text-lg font-medium text-hot-white">
          Editorial data
        </h2>
        <div>
          <div className="flex items-center justify-between mb-2">
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
          <div className="flex items-center justify-between mb-2">
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
        <div>
          <label className={labelClass}>Sub-scores (e.g. Performance, Value)</label>
          <div className="space-y-2">
            {subScores.map((entry, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={entry.key}
                  onChange={(e) => updateSubScoreKey(i, e.target.value)}
                  className={`${inputClass} flex-1`}
                  placeholder="Label"
                />
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={entry.value}
                  onChange={(e) => updateSubScore(i, Number(e.target.value))}
                  className={`${inputClass} w-24`}
                />
                <button
                  type="button"
                  onClick={() => removeSubScore(i)}
                  className="shrink-0 rounded px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
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

      <div className="flex gap-3 pt-4">
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
          className="rounded-md border border-white/20 px-4 py-2 font-sans text-sm text-gray-400 hover:bg-white/5 hover:text-hot-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
