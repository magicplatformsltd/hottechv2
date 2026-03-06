"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Trash2 } from "lucide-react";
import { MediaPickerModal } from "@/app/components/admin/media/MediaPickerModal";

type MediaItem = {
  id: string;
  filename: string;
  url: string;
  mime_type: string | null;
  size: number | null;
  alt_text: string | null;
  created_at: string;
};

const BUCKET = "all_media";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Extract storage path from public URL (e.g. .../object/public/all_media/xyz.jpg -> xyz.jpg) */
function getStoragePathFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/storage\/v1\/object\/public\/all_media\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export default function AdminMediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supabase = getSupabase();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("media_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setItems((data as MediaItem[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleUploadSelect = useCallback(
    (url: string) => {
      setPickerOpen(false);
      fetchItems();
    },
    [fetchItems]
  );

  const handleDelete = useCallback(
    async (item: MediaItem) => {
      if (deletingId) return;
      setDeletingId(item.id);
      const path = getStoragePathFromUrl(item.url);
      if (path) {
        await supabase.storage.from(BUCKET).remove([path]);
      }
      await supabase.from("media_items").delete().eq("id", item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setDeletingId(null);
    },
    [supabase, deletingId]
  );

  return (
    <div className="space-y-6 p-6 lg:p-10">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-hot-white">
          Media Library
        </h1>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-md bg-hot-white px-4 py-2 font-sans text-sm font-medium text-hot-black transition-colors hover:bg-hot-white/90"
        >
          Upload New
        </button>
      </div>

      {loading ? (
        <p className="font-sans text-gray-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="font-sans text-gray-400">
          No media yet. Click Upload New to add an image.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5"
            >
              <div className="aspect-square overflow-hidden bg-black">
                <img
                  src={item.url}
                  alt={item.alt_text ?? item.filename}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="truncate px-2 py-2 font-sans text-xs text-gray-400">
                {item.filename}
              </p>
              <button
                type="button"
                onClick={() => handleDelete(item)}
                disabled={deletingId === item.id}
                className="absolute right-2 top-2 rounded-md bg-red-500/80 p-1.5 text-white opacity-0 transition hover:bg-red-500 group-hover:opacity-100 disabled:opacity-50"
                aria-label={`Delete ${item.filename}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <MediaPickerModal
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(url) => {
            handleUploadSelect(url);
          }}
          context="picker"
          multiSelect={false}
        />
      )}
    </div>
  );
}
