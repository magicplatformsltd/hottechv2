"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { upsertTemplate } from "@/lib/actions/template";
import type { ProductTemplate } from "@/lib/types/product";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

type TemplateFormProps = {
  template: ProductTemplate | null;
};

export function TemplateForm({ template }: TemplateFormProps) {
  const router = useRouter();
  const isNew = !template;

  const [name, setName] = useState(template?.name ?? "");
  const [slug, setSlug] = useState(template?.slug ?? "");
  const [specSchema, setSpecSchema] = useState<string[]>(() =>
    Array.isArray(template?.spec_schema) && template.spec_schema.length > 0
      ? [...template.spec_schema]
      : [""]
  );
  const [scoreSchema, setScoreSchema] = useState<string[]>(() =>
    Array.isArray(template?.score_schema) && template.score_schema.length > 0
      ? [...template.score_schema]
      : [""]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Auto-generate slug from name when creating a new template
  useEffect(() => {
    if (isNew && name.trim()) {
      setSlug(slugify(name));
    }
  }, [isNew, name]);

  const addSpec = useCallback(() => {
    setSpecSchema((prev) => [...prev, ""]);
  }, []);

  const updateSpec = useCallback((index: number, value: string) => {
    setSpecSchema((prev) =>
      prev.map((v, i) => (i === index ? value : v))
    );
  }, []);

  const removeSpec = useCallback((index: number) => {
    setSpecSchema((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  }, []);

  const addScore = useCallback(() => {
    setScoreSchema((prev) => [...prev, ""]);
  }, []);

  const updateScore = useCallback((index: number, value: string) => {
    setScoreSchema((prev) =>
      prev.map((v, i) => (i === index ? value : v))
    );
  }, []);

  const removeScore = useCallback((index: number) => {
    setScoreSchema((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const specList = specSchema.map((s) => s.trim()).filter(Boolean);
    const scoreList = scoreSchema.map((s) => s.trim()).filter(Boolean);
    const payload: Partial<ProductTemplate> = {
      ...(template?.id ? { id: template.id } : {}),
      name: name.trim(),
      slug: slug.trim(),
      spec_schema: specList,
      score_schema: scoreList,
    };
    const result = await upsertTemplate(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/admin/products/templates");
  }

  const inputClass =
    "w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/50 focus:outline-none focus:ring-1 focus:ring-hot-white/30";
  const labelClass = "block font-sans text-sm font-medium text-gray-400 mb-1";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
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
            placeholder="e.g. Smartphone"
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
            placeholder="e.g. smartphone"
            required
          />
          {isNew && (
            <p className="mt-1 text-xs text-gray-500">
              Slug is auto-generated from the name; you can edit it.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-lg font-medium text-hot-white">
            Spec schema
          </h2>
          <button
            type="button"
            onClick={addSpec}
            className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 font-sans text-sm text-gray-400 hover:bg-white/10 hover:text-hot-white"
          >
            Add Spec
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Labels for required specs (e.g. Processor, RAM, Display).
        </p>
        <div className="space-y-2">
          {specSchema.map((value, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={value}
                onChange={(e) => updateSpec(i, e.target.value)}
                className={inputClass}
                placeholder="e.g. Processor"
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
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-lg font-medium text-hot-white">
            Score schema
          </h2>
          <button
            type="button"
            onClick={addScore}
            className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 font-sans text-sm text-gray-400 hover:bg-white/10 hover:text-hot-white"
          >
            Add Score
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Labels for sub-scores (e.g. Performance, Camera, Value).
        </p>
        <div className="space-y-2">
          {scoreSchema.map((value, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={value}
                onChange={(e) => updateScore(i, e.target.value)}
                className={inputClass}
                placeholder="e.g. Performance"
              />
              <button
                type="button"
                onClick={() => removeScore(i)}
                className="shrink-0 rounded px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
                aria-label="Remove score"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-hot-white px-4 py-2 font-sans text-sm font-medium text-hot-black transition-colors hover:bg-hot-white/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : template ? "Update Template" : "Create Template"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/products/templates")}
          className="rounded-md border border-white/20 px-4 py-2 font-sans text-sm text-gray-400 hover:bg-white/5 hover:text-hot-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
