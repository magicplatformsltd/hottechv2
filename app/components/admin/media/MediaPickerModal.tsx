"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { UploadCloud, Image as ImageIcon, X } from "lucide-react";
import imageCompression from "browser-image-compression";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const BUCKET = "all_media";

type MediaItem = {
  id: string;
  filename: string;
  url: string;
  mime_type: string | null;
  size: number | null;
  alt_text: string | null;
  created_at: string;
};

type MediaPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string, alt?: string) => void;
  /** When true, shows checkboxes and "Add selected" button; requires onSelectMultiple */
  multiSelect?: boolean;
  onSelectMultiple?: (items: { url: string; alt?: string }[]) => void;
};

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  multiSelect = false,
  onSelectMultiple,
}: MediaPickerModalProps) {
  const [view, setView] = useState<"Upload" | "Library">("Upload");
  const [images, setImages] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const supabase = getSupabase();

  useEffect(() => {
    if (!isOpen) setSelectedIds(new Set());
  }, [isOpen]);

  const fetchImages = useCallback(async () => {
    setLibraryLoading(true);
    const { data, error } = await supabase
      .from("media_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setImages((data as MediaItem[]) ?? []);
    setLibraryLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (isOpen && view === "Library") fetchImages();
  }, [isOpen, view, fetchImages]);

  const handleSelect = useCallback(
    (url: string, alt?: string) => {
      onSelect(url, alt);
      onClose();
    },
    [onSelect, onClose]
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
        } else {
          handleSelect(url);
        }
      } catch (e: unknown) {
        const err = e as { message?: string; details?: string; hint?: string };
        console.error("Upload failed:", err?.message, err?.details, err?.hint);
        setError(err?.message ?? "Upload failed. Check console.");
      } finally {
        setUploading(false);
      }
    },
    [supabase, handleSelect, multiSelect, onSelectMultiple, onClose]
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

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-2xl rounded-lg border border-white/10 bg-hot-gray text-hot-white shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="font-sans text-lg font-semibold">Choose image</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-hot-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-white/10">
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

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {view === "Upload" && (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 transition ${
                dragActive ? "border-white/50 bg-white/5" : "border-white/20"
              } ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <UploadCloud className="mb-3 h-10 w-10 text-gray-400" />
              <p className="mb-2 font-sans text-sm text-gray-400">
                Drag and drop an image, or click to browse
              </p>
              <p className="mb-4 font-sans text-xs text-gray-500">
                JPEG, PNG, WebP, GIF up to 5MB
              </p>
              <label className="cursor-pointer rounded-md bg-hot-white px-4 py-2 font-sans text-sm font-medium text-hot-gray transition hover:bg-hot-white/90">
                <input
                  type="file"
                  accept={ALLOWED_TYPES.join(",")}
                  multiple={multiSelect}
                  onChange={onInputChange}
                  className="hidden"
                />
                Select file
              </label>
              {uploading && (
                <p className="mt-3 font-sans text-xs text-gray-400">
                  Optimizing & Uploading…
                </p>
              )}
              {error && (
                <p className="mt-3 font-sans text-sm text-red-400">{error}</p>
              )}
            </div>
          )}

          {view === "Library" && (
            <div className="space-y-3">
              {libraryLoading ? (
                <p className="py-8 text-center font-sans text-sm text-gray-400">
                  Loading library…
                </p>
              ) : images.length === 0 ? (
                <p className="py-8 text-center font-sans text-sm text-gray-400">
                  No images yet. Upload one in the Upload tab.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {images.map((item) => {
                      const isSelected = multiSelect && selectedIds.has(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (multiSelect && onSelectMultiple) {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                            } else {
                              handleSelect(item.url, item.alt_text ?? undefined);
                            }
                          }}
                          className={`relative aspect-square overflow-hidden rounded-lg border transition ${
                            isSelected
                              ? "border-hot-white ring-2 ring-hot-white/50"
                              : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
                          }`}
                        >
                          <img
                            src={item.url}
                            alt={item.alt_text ?? item.filename ?? ""}
                            className="h-full w-full object-cover"
                          />
                          {multiSelect && (
                            <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/60">
                              {isSelected ? (
                                <span className="text-xs text-white">✓</span>
                              ) : (
                                <span className="h-3 w-3 rounded border border-white/60" />
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {multiSelect && onSelectMultiple && selectedIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const selected = images
                          .filter((i) => selectedIds.has(i.id))
                          .map((i) => ({ url: i.url, alt: i.alt_text ?? undefined }));
                        onSelectMultiple(selected);
                        onClose();
                      }}
                      className="w-full rounded-md bg-hot-white py-2 font-sans text-sm font-medium text-hot-gray transition hover:bg-hot-white/90"
                    >
                      Add {selectedIds.size} selected
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
