"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import { UploadCloud, Image as ImageIcon, X, Search, ChevronDown, Save } from "lucide-react";
import imageCompression from "browser-image-compression";
import { getTags } from "@/lib/actions/tags";
import { saveMediaAsset } from "@/lib/actions/media";
import { TagInput, type SelectedTag } from "@/app/components/admin/posts/TagInput";
import type { TagRow } from "@/lib/actions/tags";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const BUCKET = "all_media";

export type MediaItemWithTags = {
  id: string;
  filename: string;
  url: string;
  mime_type: string | null;
  size: number | null;
  alt_text: string | null;
  title: string | null;
  source_credit: string | null;
  created_at: string;
  media_tag_map?: { tag_id: number; tags: { id: number; name: string | null; slug: string | null } | null }[];
};

export type InsertMode = "single" | "grid" | "masonry" | "slideshow" | "comparison";

export type MediaPickerContext = "editor" | "gallery" | "comparison" | "picker";

type MediaPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (url: string, alt?: string) => void;
  multiSelect?: boolean;
  onSelectMultiple?: (items: { url: string; alt?: string }[]) => void;
  /** When "editor", shows full command center with Insert As dropdown */
  context?: MediaPickerContext;
  /** For editor context: callback with insert mode and selected items */
  onInsert?: (params: { mode: InsertMode; items: MediaItemWithTags[] }) => void;
};

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function extractTagNames(item: MediaItemWithTags): string[] {
  const maps = item.media_tag_map ?? [];
  return maps
    .map((m) => m?.tags?.name)
    .filter((n): n is string => typeof n === "string" && n.length > 0);
}

function matchesSearch(item: MediaItemWithTags, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  const filename = (item.filename ?? "").toLowerCase();
  const alt = (item.alt_text ?? "").toLowerCase();
  const title = (item.title ?? "").toLowerCase();
  const tagNames = extractTagNames(item).map((n) => n.toLowerCase());
  return (
    filename.includes(q) ||
    alt.includes(q) ||
    title.includes(q) ||
    tagNames.some((t) => t.includes(q))
  );
}

export function MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  multiSelect = false,
  onSelectMultiple,
  context = "picker",
  onInsert,
}: MediaPickerModalProps) {
  const [view, setView] = useState<"Upload" | "Library">("Library");
  const [images, setImages] = useState<MediaItemWithTags[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedItem, setFocusedItem] = useState<MediaItemWithTags | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarForm, setSidebarForm] = useState({
    alt_text: "",
    title: "",
    source_credit: "",
    tagIds: [] as number[],
  });
  const [sidebarDirty, setSidebarDirty] = useState(false);
  const [savingAsset, setSavingAsset] = useState(false);
  const [insertDropdownOpen, setInsertDropdownOpen] = useState(false);

  const supabase = getSupabase();
  const isCommandCenter = context === "editor";

  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set());
      setFocusedItem(null);
      setSearchQuery("");
      setInsertDropdownOpen(false);
    }
  }, [isOpen]);

  const fetchImages = useCallback(async () => {
    setLibraryLoading(true);
    let query = supabase
      .from("media_items")
      .select("*, media_tag_map(tags(id, name, slug))")
      .order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) {
      const { data: fallback } = await supabase
        .from("media_items")
        .select("*")
        .order("created_at", { ascending: false });
      setImages((fallback as MediaItemWithTags[]) ?? []);
    } else {
      setImages((data as MediaItemWithTags[]) ?? []);
    }
    setLibraryLoading(false);
  }, [supabase]);

  const fetchTags = useCallback(async () => {
    const t = await getTags();
    setTags(t);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchImages();
      if (isCommandCenter) fetchTags();
    }
  }, [isOpen, fetchImages, fetchTags, isCommandCenter]);

  useEffect(() => {
    if (focusedItem) {
      const tagMaps = focusedItem.media_tag_map ?? [];
      const tagIds = tagMaps
        .map((m) => m?.tags?.id)
        .filter((id): id is number => typeof id === "number");
      setSidebarForm({
        alt_text: focusedItem.alt_text ?? "",
        title: focusedItem.title ?? "",
        source_credit: focusedItem.source_credit ?? "",
        tagIds,
      });
      setSidebarDirty(false);
    }
  }, [focusedItem]);

  const filteredImages = useMemo(
    () => images.filter((i) => matchesSearch(i, searchQuery)),
    [images, searchQuery]
  );

  const selectedItems = useMemo(
    () => images.filter((i) => selectedIds.has(i.id)),
    [images, selectedIds]
  );

  const handleSelect = useCallback(
    (url: string, alt?: string) => {
      onSelect?.(url, alt);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleSaveAsset = useCallback(async () => {
    if (!focusedItem || !sidebarDirty) return;
    setSavingAsset(true);
    try {
      const err = await saveMediaAsset(focusedItem.id, {
        alt_text: sidebarForm.alt_text || null,
        title: sidebarForm.title || null,
        source_credit: sidebarForm.source_credit || null,
      }, sidebarForm.tagIds);
      if (err?.error) {
        setError(err.error);
      } else {
        setSidebarDirty(false);
        await fetchImages();
        setFocusedItem((prev) =>
          prev ? { ...prev, ...sidebarForm, media_tag_map: prev.media_tag_map } : null
        );
      }
    } finally {
      setSavingAsset(false);
    }
  }, [focusedItem, sidebarDirty, sidebarForm, fetchImages]);

  const savePendingBeforeInsert = useCallback(async () => {
    if (focusedItem && sidebarDirty) {
      await handleSaveAsset();
    }
  }, [focusedItem, sidebarDirty, handleSaveAsset]);

  const handleInsert = useCallback(
    async (mode: InsertMode) => {
      await savePendingBeforeInsert();
      setInsertDropdownOpen(false);

      if (isCommandCenter && onInsert) {
        const items = selectedItems;
        if (mode === "single" && items.length >= 1) {
          onInsert({ mode: "single", items: items.slice(0, 1) });
        } else if ((mode === "grid" || mode === "masonry" || mode === "slideshow") && items.length >= 1) {
          onInsert({ mode, items });
        } else if (mode === "comparison" && items.length === 2) {
          onInsert({ mode: "comparison", items: items.slice(0, 2) });
        }
        onClose();
        return;
      }

      if (mode === "single" && onSelect && selectedItems.length >= 1) {
        const first = selectedItems[0];
        handleSelect(first.url, first.alt_text ?? undefined);
      } else if (onSelectMultiple && selectedItems.length >= 1) {
        onSelectMultiple(
          selectedItems.map((i) => ({ url: i.url, alt: i.alt_text ?? undefined }))
        );
        onClose();
      }
    },
    [
      savePendingBeforeInsert,
      isCommandCenter,
      onInsert,
      selectedItems,
      onSelect,
      onSelectMultiple,
      handleSelect,
      onClose,
    ]
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!ALLOWED_TYPES.includes(file.type)) return;
      setError(null);
      setUploading(true);
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });

        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, compressed, {
            contentType: compressed.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const url = urlData.publicUrl;

        const { error: insertError } = await supabase.from("media_items").insert({
          filename: file.name,
          url,
          mime_type: compressed.type,
          size: compressed.size,
        });

        if (insertError) throw insertError;

        if (multiSelect && onSelectMultiple) {
          onSelectMultiple([{ url, alt: file.name }]);
          onClose();
        } else if (!isCommandCenter) {
          handleSelect(url);
        } else {
          await fetchImages();
        }
      } catch (e: unknown) {
        const err = e as { message?: string };
        setError(err?.message ?? "Upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [supabase, handleSelect, multiSelect, onSelectMultiple, onClose, isCommandCenter, fetchImages]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      if (multiSelect && onSelectMultiple && files.length >= 1) {
        Promise.all(
          Array.from(files)
            .filter((f) => ALLOWED_TYPES.includes(f.type))
            .map((file) =>
              imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true }).then(
                async (compressed) => {
                  const ext = file.name.split(".").pop() ?? "jpg";
                  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, compressed, {
                    contentType: compressed.type,
                    upsert: false,
                  });
                  if (uploadError) throw uploadError;
                  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
                  await supabase.from("media_items").insert({
                    filename: file.name,
                    url: urlData.publicUrl,
                    mime_type: compressed.type,
                    size: compressed.size,
                  });
                  return { url: urlData.publicUrl, alt: file.name };
                }
              )
            )
        ).then((items) => {
          if (items.length) {
            onSelectMultiple(items);
            onClose();
          }
          e.target.value = "";
        });
      } else {
        handleFile(files[0]);
        e.target.value = "";
      }
    },
    [handleFile, multiSelect, onSelectMultiple, onClose, supabase]
  );

  const toggleSelect = (e: React.MouseEvent, item: MediaItemWithTags) => {
    e.stopPropagation();
    if (isCommandCenter || multiSelect) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    } else {
      handleSelect(item.url, item.alt_text ?? undefined);
    }
  };

  const handleThumbnailClick = (item: MediaItemWithTags) => {
    if (isCommandCenter) {
      setFocusedItem(item);
    } else if (!multiSelect && onSelect) {
      handleSelect(item.url, item.alt_text ?? undefined);
    }
  };

  const tagOptions = useMemo(
    () => tags.map((t) => ({ id: t.id, name: t.name ?? "" })),
    [tags]
  );
  const sidebarSelectedTags: SelectedTag[] = useMemo(
    () =>
      sidebarForm.tagIds
        .map((id) => {
          const t = tags.find((x) => x.id === id);
          return t ? { id: t.id, name: t.name ?? "" } : null;
        })
        .filter((t): t is SelectedTag => t != null),
    [sidebarForm.tagIds, tags]
  );

  if (!isOpen) return null;

  const showInsertDropdown = isCommandCenter && selectedIds.size >= 1;
  const canComparison = selectedIds.size === 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div
        className={`relative flex flex-col rounded-lg border border-white/10 bg-hot-gray text-hot-white shadow-xl ${
          isCommandCenter ? "h-[90vh] w-[90vw] max-w-[1400px]" : "w-full max-w-2xl"
        }`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="font-sans text-lg font-semibold">
            {isCommandCenter ? "Media Command Center" : "Choose image"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-hot-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs (Upload / Library) */}
        <div className="flex shrink-0 border-b border-white/10">
          <button
            type="button"
            onClick={() => setView("Upload")}
            className={`flex items-center gap-2 px-4 py-3 font-sans text-sm font-medium transition ${
              view === "Upload"
                ? "border-b-2 border-hot-white text-hot-white"
                : "text-gray-400 hover:text-hot-white"
            }`}
          >
            <UploadCloud className="h-4 w-4" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => setView("Library")}
            className={`flex items-center gap-2 px-4 py-3 font-sans text-sm font-medium transition ${
              view === "Library"
                ? "border-b-2 border-hot-white text-hot-white"
                : "text-gray-400 hover:text-hot-white"
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            Library
          </button>
        </div>

        {/* Main content: 70/30 or single area */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {view === "Upload" && (
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              className={`flex flex-1 flex-col items-center justify-center gap-4 border-2 border-dashed py-12 transition ${
                dragActive ? "border-white/50 bg-white/5" : "border-white/20"
              } ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <UploadCloud className="h-10 w-10 text-gray-400" />
              <p className="font-sans text-sm text-gray-400">
                Drag and drop images, or click to browse
              </p>
              <label className="cursor-pointer rounded-md bg-hot-white px-4 py-2 font-sans text-sm font-medium text-hot-gray transition hover:bg-hot-white/90">
                <input
                  type="file"
                  accept={ALLOWED_TYPES.join(",")}
                  multiple={multiSelect || isCommandCenter}
                  onChange={onInputChange}
                  className="hidden"
                />
                Select file
              </label>
              {error && <p className="font-sans text-sm text-red-400">{error}</p>}
            </div>
          )}

          {view === "Library" && (
            <>
              {/* 70% Gallery */}
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {isCommandCenter && (
                  <div className="shrink-0 border-b border-white/10 px-4 py-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by filename, alt text, or tags…"
                        className="w-full rounded-md border border-white/10 bg-white/5 py-2 pl-9 pr-3 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-white/30 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-4">
                  {libraryLoading ? (
                    <p className="py-8 text-center font-sans text-sm text-gray-400">Loading…</p>
                  ) : filteredImages.length === 0 ? (
                    <p className="py-8 text-center font-sans text-sm text-gray-400">
                      No images found.
                    </p>
                  ) : (
                    <div
                      className={`grid gap-2 ${
                        isCommandCenter
                          ? "grid-cols-4 sm:grid-cols-5 lg:grid-cols-6"
                          : "grid-cols-3"
                      }`}
                    >
                      {filteredImages.map((item) => {
                        const isSelected = selectedIds.has(item.id);
                        const isFocused = focusedItem?.id === item.id;
                        return (
                          <div
                            key={item.id}
                            className={`group relative aspect-square overflow-hidden rounded-lg border transition ${
                              isFocused
                                ? "ring-2 ring-hot-white"
                                : isSelected
                                  ? "border-hot-white ring-2 ring-hot-white/50"
                                  : "border-white/10 bg-white/5 hover:border-white/30"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleThumbnailClick(item)}
                              className="absolute inset-0 h-full w-full"
                            >
                              <Image
                                src={item.url}
                                alt={item.alt_text ?? item.filename ?? ""}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 25vw, (max-width: 1024px) 20vw, 16vw"
                              />
                            </button>
                            {(isCommandCenter || multiSelect) && (
                              <button
                                type="button"
                                onClick={(e) => toggleSelect(e, item)}
                                className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded border transition ${
                                  isSelected
                                    ? "border-hot-white bg-hot-white/80 text-hot-gray"
                                    : "border-white/60 bg-black/60 text-white hover:bg-black/80"
                                }`}
                                aria-label={isSelected ? "Deselect" : "Select"}
                              >
                                {isSelected ? "✓" : ""}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 30% Sidebar (command center only) */}
              {isCommandCenter && (
                <div className="flex w-[30%] min-w-[280px] flex-col border-l border-white/10 bg-hot-black/30">
                  {focusedItem ? (
                    <div className="flex flex-1 flex-col overflow-y-auto p-4">
                      <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-lg bg-hot-gray">
                        <Image
                          src={focusedItem.url}
                          alt={focusedItem.alt_text ?? focusedItem.filename ?? ""}
                          fill
                          className="object-contain"
                          sizes="280px"
                        />
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block font-sans text-xs text-gray-500">
                            Alt text
                          </label>
                          <input
                            type="text"
                            value={sidebarForm.alt_text}
                            onChange={(e) => {
                              setSidebarForm((s) => ({ ...s, alt_text: e.target.value }));
                              setSidebarDirty(true);
                            }}
                            className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 font-sans text-sm text-hot-white focus:border-white/30 focus:outline-none"
                            placeholder="Describe the image"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block font-sans text-xs text-gray-500">Title</label>
                          <input
                            type="text"
                            value={sidebarForm.title}
                            onChange={(e) => {
                              setSidebarForm((s) => ({ ...s, title: e.target.value }));
                              setSidebarDirty(true);
                            }}
                            className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 font-sans text-sm text-hot-white focus:border-white/30 focus:outline-none"
                            placeholder="Optional title"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block font-sans text-xs text-gray-500">
                            Source credit
                          </label>
                          <input
                            type="text"
                            value={sidebarForm.source_credit}
                            onChange={(e) => {
                              setSidebarForm((s) => ({ ...s, source_credit: e.target.value }));
                              setSidebarDirty(true);
                            }}
                            className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 font-sans text-sm text-hot-white focus:border-white/30 focus:outline-none"
                            placeholder="Photo credit"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block font-sans text-xs text-gray-500">Tags</label>
                          <TagInput
                            availableTags={tagOptions}
                            selectedTags={sidebarSelectedTags}
                            onChange={(next) => {
                              setSidebarForm((s) => ({
                                ...s,
                                tagIds: next.map((t) => t.id).filter((id) => id > 0),
                              }));
                              setSidebarDirty(true);
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveAsset}
                          disabled={!sidebarDirty || savingAsset}
                          className="flex w-full items-center justify-center gap-2 rounded-md bg-hot-white py-2 font-sans text-sm font-medium text-hot-gray transition hover:bg-hot-white/90 disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          Save Asset
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center p-4 text-center">
                      <p className="font-sans text-sm text-gray-500">
                        Click an image to view and edit metadata
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 10% Fixed Footer */}
        <div className="shrink-0 border-t border-white/10 bg-hot-gray/95 px-4 py-3">
          {isCommandCenter && showInsertDropdown ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setInsertDropdownOpen((o) => !o)}
                className="flex items-center gap-2 rounded-md bg-hot-white px-4 py-2 font-sans text-sm font-medium text-hot-gray transition hover:bg-hot-white/90"
              >
                Insert As…
                <ChevronDown className="h-4 w-4" />
              </button>
              {insertDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setInsertDropdownOpen(false)}
                    aria-hidden
                  />
                  <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[200px] rounded-md border border-white/10 bg-hot-gray py-1 shadow-xl">
                    <button
                      type="button"
                      onClick={() => handleInsert("single")}
                      className="w-full px-4 py-2 text-left font-sans text-sm text-hot-white hover:bg-white/10"
                    >
                      Single Image
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsert("grid")}
                      disabled={selectedItems.length < 1}
                      className="w-full px-4 py-2 text-left font-sans text-sm text-hot-white hover:bg-white/10 disabled:opacity-50"
                    >
                      Grid Gallery
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsert("masonry")}
                      disabled={selectedItems.length < 1}
                      className="w-full px-4 py-2 text-left font-sans text-sm text-hot-white hover:bg-white/10 disabled:opacity-50"
                    >
                      Masonry Gallery
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsert("slideshow")}
                      disabled={selectedItems.length < 1}
                      className="w-full px-4 py-2 text-left font-sans text-sm text-hot-white hover:bg-white/10 disabled:opacity-50"
                    >
                      Slideshow
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsert("comparison")}
                      disabled={!canComparison}
                      className="w-full px-4 py-2 text-left font-sans text-sm text-hot-white hover:bg-white/10 disabled:opacity-50"
                    >
                      Comparison Slider {!canComparison && "(select 2)"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : multiSelect && onSelectMultiple && selectedIds.size > 0 ? (
            <button
              type="button"
              onClick={() => {
                const selected = images
                  .filter((i) => selectedIds.has(i.id))
                  .map((i) => ({ url: i.url, alt: i.alt_text ?? undefined }));
                onSelectMultiple(selected);
                onClose();
              }}
              className="rounded-md bg-hot-white py-2 px-4 font-sans text-sm font-medium text-hot-gray transition hover:bg-hot-white/90"
            >
              Add {selectedIds.size} selected
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
