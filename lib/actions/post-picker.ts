"use server";

import { createClient } from "@/utils/supabase/server";

export type PostPickerPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  image: string | null;
  published_at: string | null;
};

export async function searchPosts(query?: string): Promise<PostPickerPost[]> {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];

  const nowIso = new Date().toISOString();
  let q = client
    .from("posts")
    .select("id, title, slug, excerpt, main_image, published_at")
    .eq("status", "published")
    .lte("published_at", nowIso)
    .order("published_at", { ascending: false });

  const trimmed = (query ?? "").trim();
  if (trimmed) {
    q = q.ilike("title", `%${trimmed}%`);
  }

  const { data, error } = await q.limit(50);

  if (error) {
    console.error("[searchPosts]", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: (row as { id: string }).id,
    title: (row as { title: string }).title ?? "",
    slug: (row as { slug: string }).slug ?? "",
    excerpt: (row as { excerpt: string | null }).excerpt ?? null,
    image: (row as { main_image: string | null }).main_image ?? null,
    published_at: (row as { published_at: string | null }).published_at ?? null,
  }));
}
