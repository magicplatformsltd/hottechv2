"use server";

import { createClient } from "@/utils/supabase/server";
import type { FeedItem } from "@/lib/types";

/** Fetch published posts for the public archive, ordered by published_at desc. Returns FeedItem[] for grid display. */
export async function getMorePosts(
  offset: number,
  limit: number = 21
): Promise<FeedItem[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, slug, excerpt, main_image, featured_image, original_url, published_at, created_at, updated_at, type, source_name")
    .eq("status", "published")
    .lte("published_at", nowIso)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[getMorePosts]", error);
    return [];
  }

  const rows = data ?? [];
  return rows.map((post) => {
    const date = post.published_at ?? post.created_at ?? post.updated_at ?? new Date().toISOString();
    const hasExternalUrl = post.original_url != null && String(post.original_url).trim() !== "";
    const url = hasExternalUrl ? String(post.original_url) : `/${post.slug ?? post.id}`;
    const image = post.featured_image ?? post.main_image ?? undefined;
    const type = hasExternalUrl ? ("external-article" as const) : ("post" as const);
    return {
      id: post.id,
      title: post.title ?? "Untitled",
      excerpt: post.excerpt ?? undefined,
      date,
      type,
      source: "internal" as const,
      url,
      image,
      publisher: post.source_name ?? "House of Tech",
    } satisfies FeedItem;
  });
}
