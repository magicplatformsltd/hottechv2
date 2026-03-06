"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/admin/editor/RichTextEditor";
import { updatePost, createPost, publishPost, type PostRow } from "./actions";
import { createTag } from "@/lib/actions/tags";
import type { CategoryRow } from "@/lib/actions/categories";
import type { TagRow } from "@/lib/actions/tags";
import type { ContentTypeRow } from "@/lib/actions/content-types";
import { SidebarSection } from "@/app/components/admin/posts/SidebarSection";
import { ShowcaseManager, type ShowcaseItem } from "@/app/components/admin/posts/ShowcaseManager";
import { TagInput, type SelectedTag } from "@/app/components/admin/posts/TagInput";
import { UniversalImagePicker } from "@/app/components/admin/shared/UniversalImagePicker";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const DEFAULT_TIMEZONE = "America/New_York";

function toDatetimeLocalInTz(iso: string | null, timezone: string): string {
  if (!iso) return "";
  try {
    return formatInTimeZone(new Date(iso), timezone, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

/** Convert datetime-local string (in site timezone) to UTC ISO. */
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

/** Get short timezone label (e.g. EST, EDT) for display. */
function getTimezoneLabel(timezone: string): string {
  try {
    return formatInTimeZone(new Date(), timezone, "zzz");
  } catch {
    return timezone;
  }
}

function buildCategoryRows(categories: CategoryRow[]): { category: CategoryRow; depth: number }[] {
  const byParent = new Map<number | null, CategoryRow[]>();
  for (const c of categories) {
    const key = c.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  const result: { category: CategoryRow; depth: number }[] = [];
  function visit(parentId: number | null, depth: number) {
    const list = byParent.get(parentId) ?? [];
    list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    for (const c of list) {
      result.push({ category: c, depth });
      visit(c.id, depth + 1);
    }
  }
  visit(null, 0);
  return result;
}

type EditPostFormProps = {
  post: PostRow | null;
  categories: CategoryRow[];
  tags: TagRow[];
  contentTypes: ContentTypeRow[];
  initialCategoryIds: number[];
  initialTagIds: number[];
  initialContentTypeId: number | null;
  siteTimezone?: string;
};

export function EditPostForm({
  post,
  categories,
  tags,
  contentTypes,
  initialCategoryIds,
  initialTagIds,
  initialContentTypeId,
  siteTimezone = DEFAULT_TIMEZONE,
}: EditPostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [status, setStatus] = useState<"draft" | "published">(
    (post?.status as "draft" | "published") || "draft"
  );
  const [publishedAt, setPublishedAt] = useState(
    toDatetimeLocalInTz(post?.published_at ?? null, siteTimezone)
  );
  const [sourceName, setSourceName] = useState(post?.source_name ?? "");
  const [originalUrl, setOriginalUrl] = useState(post?.original_url ?? "");
  const [metaTitle, setMetaTitle] = useState(post?.meta_title ?? "");
  const [metaDescription, setMetaDescription] = useState(post?.meta_description ?? "");
  const [canonicalUrl, setCanonicalUrl] = useState(post?.canonical_url ?? "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(
    post?.featured_image ?? null
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(
    () => new Set(initialCategoryIds)
  );
  const [primaryCategoryId, setPrimaryCategoryId] = useState<number | null>(() => {
    const v = post?.primary_category_id;
    return v != null && typeof v === "number" ? v : null;
  });
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>(() =>
    initialTagIds.map((id) => {
      const t = tags.find((x) => x.id === id);
      return { id: t?.id ?? id, name: t?.name ?? String(id) };
    })
  );
  const [selectedContentTypeId, setSelectedContentTypeId] = useState<number | null>(
    initialContentTypeId
  );
  const [displayOptions, setDisplayOptions] = useState<Record<string, unknown>>(() => {
    const opts = post?.display_options;
    if (opts != null && typeof opts === "object" && !Array.isArray(opts)) {
      return { ...(opts as Record<string, unknown>) };
    }
    return {};
  });
  const [showcaseData, setShowcaseData] = useState<ShowcaseItem[]>(() => {
    const raw = post?.showcase_data;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (x): x is ShowcaseItem =>
        x != null &&
        typeof x === "object" &&
        typeof (x as ShowcaseItem).id === "string" &&
        typeof (x as ShowcaseItem).title === "string"
    ) as ShowcaseItem[];
  });
  const [saving, setSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);

  const categoryRows = useMemo(() => buildCategoryRows(categories), [categories]);

  const isScheduled = (() => {
    if (status !== "published" || !publishedAt) return false;
    const utc = fromDatetimeLocalToUtc(publishedAt, siteTimezone);
    return !!utc && new Date(utc) > new Date();
  })();
  const selectedContentTypeSlug =
    contentTypes.find((ct) => ct.id === selectedContentTypeId)?.slug ?? null;
  const isShowcase = selectedContentTypeSlug?.startsWith("showcase_") ?? false;
  const showcaseType: "people" | "products" =
    selectedContentTypeSlug === "showcase_people" ? "people" : "products";
  const availableTagOptions = useMemo(
    () => tags.map((t) => ({ id: t.id, name: t.name ?? "", slug: t.slug ?? "" })),
    [tags]
  );

  function slugify(text: string) {
    return text
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]+/g, "")
      .trim();
  }

  const lastAutoSlugRef = useRef(slugify(post?.title ?? ""));
  const [isSlugDirty, setSlugDirty] = useState(() => {
    if (!post?.slug) return false;
    return post.slug !== slugify(post.title ?? "");
  });

  useEffect(() => {
    if (isSlugDirty) return;
    const newAuto = slugify(title);
    if (!title || (slug !== "" && slug !== lastAutoSlugRef.current)) return;
    setSlug(newAuto);
    lastAutoSlugRef.current = newAuto;
  }, [title, isSlugDirty, slug]);

  function handleTitleChange(value: string) {
    setTitle(value);
  }

  function handleTitleBlur() {
    if (isSlugDirty) return;
    const newAuto = slugify(title);
    if (slug === "" || slug === lastAutoSlugRef.current) {
      setSlug(newAuto);
      lastAutoSlugRef.current = newAuto;
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    setSlugDirty(true);
  }

  function handleGenerateSlug() {
    setSlug(slugify(title));
    lastAutoSlugRef.current = slugify(title);
    setSlugDirty(false);
  }

  function toggleCategory(id: number) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(t);
  }, [successMessage]);

  useEffect(() => {
    if (primaryCategoryId != null && !selectedCategoryIds.has(primaryCategoryId)) {
      setPrimaryCategoryId(null);
    }
  }, [selectedCategoryIds, primaryCategoryId]);

  async function buildPostFormData(): Promise<FormData | null> {
    const newTags = selectedTags.filter((t) => t.isNew);
    const existingTagIds = selectedTags.filter((t) => !t.isNew).map((t) => t.id);
    const createdIds: number[] = [];
    for (const t of newTags) {
      const fd = new FormData();
      fd.set("name", t.name);
      const res = await createTag(fd);
      if (res.error) {
        setError(res.error);
        return null;
      }
      if (res.id != null) createdIds.push(res.id);
    }
    const finalTagIds = [...existingTagIds, ...createdIds];
    const latestContent = editorRef.current?.getHTML() ?? body;
    const formData = new FormData();
    formData.set("title", title);
    formData.set("slug", slug);
    formData.set("excerpt", excerpt);
    formData.set("body", latestContent);
    formData.set("featured_image", featuredImageUrl ?? "");
    formData.set("status", "draft");
    if (publishedAt) {
      const utcIso = fromDatetimeLocalToUtc(publishedAt, siteTimezone);
      if (utcIso) formData.set("published_at", utcIso);
    }
    formData.set("source_name", sourceName);
    formData.set("original_url", originalUrl);
    formData.set("meta_title", metaTitle);
    formData.set("meta_description", metaDescription);
    formData.set("canonical_url", canonicalUrl);
    selectedCategoryIds.forEach((id) => formData.append("category_ids", String(id)));
    finalTagIds.forEach((id) => formData.append("tag_ids", String(id)));
    if (selectedContentTypeId != null) formData.set("content_type_id", String(selectedContentTypeId));
    formData.set("primary_category_id", primaryCategoryId != null ? String(primaryCategoryId) : "");
    formData.set("showcase_data", JSON.stringify(showcaseData));
    formData.set("display_options", JSON.stringify(displayOptions));
    return formData;
  }

  async function handleSave(asDraft: boolean) {
    setError("");
    setSuccessMessage(null);
    setSaving(true);
    const formData = await buildPostFormData();
    if (!formData) {
      setSaving(false);
      toast.error("Failed to save post");
      return;
    }
    formData.set("status", asDraft ? "draft" : "published");

    if (post?.id) {
      const saveResult = await updatePost(post.id, formData);
      if (saveResult.error) {
        setSaving(false);
        setError(saveResult.error);
        toast.error("Failed to save post");
        return;
      }
      if (!asDraft) {
        const pubResult = await publishPost(post.id);
        setSaving(false);
        if (pubResult.error) {
          setError(pubResult.error);
          toast.error("Draft saved but publish failed");
          return;
        }
        setSuccessMessage("Published!");
        toast.success("Post is now live");
        return;
      }
      setSaving(false);
      setSuccessMessage("Saved!");
      toast.success("Draft saved");
      return;
    } else {
      const result = await createPost(formData);
      setSaving(false);
      if (result.error) {
        setError(result.error);
        toast.error("Failed to save post");
        return;
      }
      if (result.id) {
        toast.success("Post created");
        router.push(`/admin/posts/${result.id}`);
      }
    }
  }

  async function handlePublish() {
    if (!post?.id) return;
    setError("");
    setSuccessMessage(null);
    setIsPublishing(true);
    const formData = await buildPostFormData();
    if (!formData) {
      setIsPublishing(false);
      toast.error("Failed to save draft");
      return;
    }
    const saveResult = await updatePost(post.id, formData);
    if (saveResult.error) {
      setIsPublishing(false);
      setError(saveResult.error);
      toast.error("Failed to publish");
      return;
    }
    const pubResult = await publishPost(post.id);
    setIsPublishing(false);
    if (pubResult.error) {
      setError(pubResult.error);
      toast.error("Failed to publish");
      return;
    }
    setSuccessMessage("Published!");
    toast.success("Post published successfully!");
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <div className="min-w-0 flex-1 space-y-6 p-6 lg:max-w-[66.666%]">
        <div>
          <label className="block font-sans text-sm font-medium text-gray-400">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Post title"
            className="mt-2 w-full rounded-md border border-white/10 bg-hot-gray px-4 py-3 font-serif text-xl text-hot-white placeholder-gray-500 focus:border-hot-white/30 focus:outline-none focus:ring-1 focus:ring-hot-white/20"
          />
        </div>
        <div>
          <label className="block font-sans text-sm font-medium text-gray-400">
            Excerpt
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Short summary…"
            rows={3}
            className="mt-2 w-full resize-y rounded-md border border-white/10 bg-hot-gray px-4 py-3 font-sans text-sm text-hot-white placeholder-gray-500 focus:border-hot-white/30 focus:outline-none focus:ring-1 focus:ring-hot-white/20"
          />
        </div>
        <div>
          <label className="block font-sans text-sm font-medium text-gray-400">
            Body
          </label>
          <RichTextEditor
            ref={editorRef}
            content={body}
            onChange={setBody}
            placeholder="Write your story…"
            className="mt-2"
          />
        </div>
        {isShowcase && (
          <ShowcaseManager
            items={showcaseData}
            onChange={setShowcaseData}
            type={showcaseType}
            displayOptions={displayOptions}
            onDisplayOptionsChange={setDisplayOptions}
          />
        )}
      </div>

      <aside className="sticky top-20 h-fit w-full shrink-0 space-y-4 p-4 lg:w-[33.333%]">
        {successMessage && (
          <div className="rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-400">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <SidebarSection
          title={`Publish Date (${getTimezoneLabel(siteTimezone)})`}
          defaultOpen={true}
        >
          <input
            type="datetime-local"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-hot-black px-3 py-2 font-sans text-sm text-hot-white focus:border-hot-white/30 focus:outline-none"
          />
        </SidebarSection>

        <SidebarSection title="Publication Info" defaultOpen={true}>
          <div className="space-y-2">
            <div>
              <label className="block font-sans text-xs text-gray-500">Source</label>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. Forbes, Authory"
                className="mt-1 w-full rounded-md border border-white/10 bg-hot-black px-3 py-2 font-sans text-sm text-hot-white placeholder-gray-500 focus:border-hot-white/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-sans text-xs text-gray-500">Original URL</label>
              <input
                type="url"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                placeholder="https://…"
                className="mt-1 w-full rounded-md border border-white/10 bg-hot-black px-3 py-2 font-sans text-sm text-hot-white placeholder-gray-500 focus:border-hot-white/30 focus:outline-none"
              />
            </div>
          </div>
        </SidebarSection>

        <SidebarSection title="Display Settings" defaultOpen={false}>
          <label className="flex cursor-pointer items-center gap-2 font-sans text-sm">
            <input
              type="checkbox"
              checked={displayOptions.hide_header === true}
              onChange={(e) => setDisplayOptions((prev) => ({ ...prev, hide_header: e.target.checked }))}
              className="rounded border-white/20 bg-hot-black text-hot-white focus:ring-0"
            />
            <span className="text-hot-white">Hide Header</span>
          </label>
          <p className="mt-1.5 font-sans text-xs text-gray-500">
            Hides title, date, and breadcrumbs for a landing page look.
          </p>
        </SidebarSection>

        <SidebarSection title="Content Type" defaultOpen={true}>
          <select
            value={selectedContentTypeId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedContentTypeId(v === "" ? null : parseInt(v, 10));
            }}
            className="w-full rounded-md border border-white/10 bg-hot-black px-3 py-2 font-sans text-sm text-hot-white focus:border-hot-white/30 focus:outline-none"
          >
            <option value="">None</option>
            {contentTypes.map((ct) => (
              <option key={ct.id} value={ct.id}>
                {ct.name}
              </option>
            ))}
          </select>
        </SidebarSection>

        <SidebarSection title="Categories" defaultOpen={true}>
          <div className="max-h-[450px] space-y-1 overflow-y-auto pr-2">
            {categoryRows.length === 0 ? (
              <p className="text-xs text-gray-500">No categories defined.</p>
            ) : (
              categoryRows.map(({ category: c, depth }) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 py-0.5 font-sans text-sm"
                  style={{ paddingLeft: `${depth * 12}px` }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.has(c.id)}
                    onChange={() => toggleCategory(c.id)}
                    className="rounded border-white/20 bg-hot-black text-hot-white focus:ring-0"
                  />
                  {depth > 0 && <span className="text-gray-500">↳</span>}
                  <span className="text-hot-white">{c.name}</span>
                </label>
              ))
            )}
          </div>
        </SidebarSection>

        <SidebarSection title="Primary Category" defaultOpen={true}>
          <select
            name="primary_category_id"
            value={primaryCategoryId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setPrimaryCategoryId(v === "" ? null : parseInt(v, 10));
            }}
            disabled={selectedCategoryIds.size === 0}
            className="w-full rounded-md border border-white/10 bg-hot-black px-3 py-2 font-sans text-sm text-hot-white focus:border-hot-white/30 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedCategoryIds.size === 0 ? (
              <option value="">Select categories first…</option>
            ) : (
              <>
                <option value="">None</option>
                {categories
                  .filter((c) => selectedCategoryIds.has(c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </>
            )}
          </select>
        </SidebarSection>

        <SidebarSection title="Tags" defaultOpen={true}>
          <TagInput
            availableTags={availableTagOptions}
            selectedTags={selectedTags}
            onChange={setSelectedTags}
          />
        </SidebarSection>

        <SidebarSection title="Publish" defaultOpen={true}>
          <div className="space-y-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "published")}
              className="w-full rounded-md border border-white/10 bg-hot-black px-3 py-2 font-sans text-sm text-hot-white focus:border-hot-white/30 focus:outline-none"
            >
              <option value="draft">Draft</option>
              <option value="published">
                {status === "published" && isScheduled ? "Scheduled" : "Published"}
              </option>
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving || isPublishing}
                className="flex-1 rounded-md border border-white/20 bg-white/5 py-2 font-sans text-sm font-medium text-hot-white transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={() => (post?.id ? handlePublish() : handleSave(false))}
                disabled={saving || isPublishing}
                className="flex-1 rounded-md bg-hot-white py-2 font-sans text-sm font-medium text-hot-black transition-colors hover:bg-hot-white/90 disabled:opacity-50"
              >
                {post?.id
                  ? isPublishing
                    ? isScheduled
                      ? "Scheduling…"
                      : "Publishing…"
                    : isScheduled
                      ? "Schedule"
                      : "Publish"
                  : saving
                    ? "Saving…"
                    : isScheduled
                      ? "Schedule"
                      : "Publish"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { if (post?.id) window.open(`/admin/preview/${post.id}`, "_blank"); }}
              disabled={!post?.id}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-white/5 py-2 font-sans text-sm font-medium text-hot-white transition-colors hover:bg-white/10 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
          </div>
        </SidebarSection>

        <SidebarSection title="URL Slug" defaultOpen={false}>
          <div className="flex gap-2">
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="url-slug"
              className="flex-1 rounded-md border border-white/10 bg-hot-black px-3 py-2 font-sans text-sm text-hot-white placeholder-gray-500 focus:border-hot-white/30 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleGenerateSlug}
              className="shrink-0 rounded-md border border-white/20 px-3 py-2 font-sans text-sm text-hot-white hover:bg-white/10"
            >
              Generate
            </button>
          </div>
        </SidebarSection>

        <SidebarSection title="SEO" defaultOpen={false}>
          <div className="space-y-2">
            <div>
              <label className="block font-sans text-xs text-gray-500">Meta Title</label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder="Title for search results"
                className="mt-1 w-full rounded-md border border-white/10 bg-hot-black px-3 py-2 font-sans text-sm text-hot-white placeholder-gray-500 focus:border-hot-white/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-sans text-xs text-gray-500">Meta Description</label>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="Short description for search results"
                rows={2}
                className="mt-1 w-full resize-y rounded-md border border-white/10 bg-hot-black px-3 py-2 font-sans text-sm text-hot-white placeholder-gray-500 focus:border-hot-white/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-sans text-xs text-gray-500">Canonical URL</label>
              <input
                type="url"
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                placeholder="https://…"
                className="mt-1 w-full rounded-md border border-white/10 bg-hot-black px-3 py-2 font-sans text-sm text-hot-white placeholder-gray-500 focus:border-hot-white/30 focus:outline-none"
              />
            </div>
          </div>
        </SidebarSection>

        <SidebarSection title="Featured Image" defaultOpen={false}>
          <UniversalImagePicker
            value={featuredImageUrl}
            onChange={(url) => setFeaturedImageUrl(url || null)}
          />
        </SidebarSection>
      </aside>
    </div>
  );
}
