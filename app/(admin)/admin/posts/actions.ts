"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

const BUCKET = "post-images";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .trim();
}

export async function uploadPostImage(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file") as File | null;
  if (!file || !file.size) {
    return { error: "No file provided." };
  }

  const supabaseServer = await createClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  if (!user) {
    return { error: "Unauthorized." };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabaseServer.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false });

  if (uploadError) {
    console.error("[uploadPostImage]", uploadError);
    return { error: uploadError.message };
  }

  const {
    data: { publicUrl },
  } = supabaseServer.storage.from(BUCKET).getPublicUrl(path);
  return { url: publicUrl };
}

export type PostRow = {
  id: string;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  body: string | null;
  featured_image: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  source_name: string | null;
  original_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  /** Showcase items (Best of / Awards). JSON array. */
  showcase_data: unknown[];
  /** Display options (e.g. hide_header for landing page). */
  display_options: Record<string, unknown>;
  /** First N category names for list display (from post_categories join). */
  category_names?: string[];
  /** First N tag names for list display (from post_tags join). */
  tag_names?: string[];
}

export async function getPosts(): Promise<PostRow[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("posts")
    .select("id, title, slug, excerpt, content, main_image, status, created_at, updated_at, published_at, post_categories(categories(name)), post_tags(tags(name))")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getPosts]", error);
    return [];
  }
  return (data ?? []).map((row: Record<string, unknown>) => {
    const { content, main_image, post_categories, post_tags, ...rest } = row;
    const pcList = Array.isArray(post_categories) ? post_categories : [];
    const category_names = pcList
      .map((pc: { categories?: { name?: string } | null }) => pc?.categories?.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0)
      .slice(0, 3);
    const ptList = Array.isArray(post_tags) ? post_tags : [];
    const tag_names = ptList
      .map((pt: { tags?: { name?: string } | null }) => pt?.tags?.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0)
      .slice(0, 3);
    return {
      ...rest,
      body: content != null ? String(content) : null,
      featured_image: main_image != null ? String(main_image) : null,
      category_names,
      tag_names,
    } as PostRow;
  });
}

export async function getPostById(id: string): Promise<PostRow | null> {
  const client = await createClient();
  const { data, error } = await client
    .from("posts")
    .select("id, title, slug, excerpt, content, main_image, status, created_at, updated_at, published_at, source_name, original_url, meta_title, meta_description, canonical_url, showcase_data, display_options, draft_title, draft_summary, draft_content, draft_hero_image")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getPostById]", error);
    return null;
  }
  if (!data) return null;
  const showcaseData = data.showcase_data;
  const displayOptions = data.display_options;
  const raw = data as Record<string, unknown>;
  const draftTitle = raw.draft_title as string | null | undefined;
  const draftSummary = raw.draft_summary as string | null | undefined;
  const draftContent = raw.draft_content as string | null | undefined;
  const draftHero = raw.draft_hero_image as string | null | undefined;
  return {
    ...data,
    title: draftTitle ?? data.title,
    excerpt: draftSummary ?? data.excerpt ?? (raw.summary as string | null) ?? null,
    body: draftContent != null ? String(draftContent) : (data.content != null ? String(data.content) : null),
    featured_image: draftHero != null ? String(draftHero) : (data.main_image != null ? String(data.main_image) : null),
    showcase_data: Array.isArray(showcaseData) ? showcaseData : [],
    display_options: displayOptions != null && typeof displayOptions === "object" && !Array.isArray(displayOptions) ? displayOptions as Record<string, unknown> : {},
  } as PostRow;
}

export type PostSearchHit = { id: string; title: string | null };

export async function searchPosts(query: string): Promise<PostSearchHit[]> {
  const client = await createClient();
  const q = (query ?? "").trim();
  if (!q) return [];

  const { data, error } = await client
    .from("posts")
    .select("id, title")
    .ilike("title", `%${q}%`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[searchPosts]", error);
    return [];
  }
  return (data ?? []) as PostSearchHit[];
}

export async function getPostTitles(ids: string[]): Promise<PostSearchHit[]> {
  if (ids.length === 0) return [];
  const client = await createClient();
  const { data, error } = await client
    .from("posts")
    .select("id, title")
    .in("id", ids);

  if (error) {
    console.error("[getPostTitles]", error);
    return [];
  }
  return (data ?? []) as PostSearchHit[];
}

export type PostTaxonomies = {
  categoryIds: number[];
  tagIds: number[];
  contentTypeId: number | null;
};

export async function getPostTaxonomies(postId: string): Promise<PostTaxonomies> {
  const client = await createClient();
  const [pc, pt, pct] = await Promise.all([
    client.from("post_categories").select("category_id").eq("post_id", postId),
    client.from("post_tags").select("tag_id").eq("post_id", postId),
    client.from("post_content_types").select("content_type_id").eq("post_id", postId).maybeSingle(),
  ]);
  const categoryIds = (pc.data ?? []).map((r: { category_id: number }) => r.category_id);
  const tagIds = (pt.data ?? []).map((r: { tag_id: number }) => r.tag_id);
  const contentTypeId =
    pct.data != null && typeof (pct.data as { content_type_id: number }).content_type_id === "number"
      ? (pct.data as { content_type_id: number }).content_type_id
      : null;
  return { categoryIds, tagIds, contentTypeId };
}

export async function createPost(formData: FormData): Promise<{ id?: string; error?: string }> {
  const supabaseServer = await createClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  if (!user) {
    return { error: "Unauthorized." };
  }

  const title = (formData.get("title") as string)?.trim() ?? "";
  let slug = (formData.get("slug") as string)?.trim() ?? "";
  const excerpt = (formData.get("excerpt") as string)?.trim() ?? "";
  const body = (formData.get("body") as string) ?? "";
  const featured_image = (formData.get("featured_image") as string) || null;
  const status = (formData.get("status") as string) || "draft";
  const published_at = (formData.get("published_at") as string) || null;
  const source_name = (formData.get("source_name") as string)?.trim() || null;
  const original_url = (formData.get("original_url") as string)?.trim() || null;
  const meta_title = (formData.get("meta_title") as string)?.trim() || null;
  const meta_description = (formData.get("meta_description") as string)?.trim() || null;
  const canonical_url = (formData.get("canonical_url") as string)?.trim() || null;
  const categoryIds = (formData.getAll("category_ids") as string[]).map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
  const tagIds = (formData.getAll("tag_ids") as string[]).map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
  const contentTypeIdRaw = formData.get("content_type_id");
  const contentTypeId =
    contentTypeIdRaw != null && String(contentTypeIdRaw).trim() !== ""
      ? parseInt(String(contentTypeIdRaw), 10)
      : null;
  const contentTypeIdValid = contentTypeId != null && !Number.isNaN(contentTypeId) ? contentTypeId : null;
  const showcaseDataRaw = formData.get("showcase_data");
  const showcaseData =
    showcaseDataRaw != null && String(showcaseDataRaw).trim() !== ""
      ? (JSON.parse(String(showcaseDataRaw)) as unknown[])
      : [];
  const displayOptionsRaw = formData.get("display_options");
  const displayOptions =
    displayOptionsRaw != null && String(displayOptionsRaw).trim() !== ""
      ? (JSON.parse(String(displayOptionsRaw)) as Record<string, unknown>)
      : {};

  if (!title) {
    return { error: "Title is required." };
  }

  if (!slug && title) {
    slug = slugify(title);
  }

  const now = new Date().toISOString();
  const publishedAt = published_at ? new Date(published_at).toISOString() : now;

  const { data, error } = await supabaseServer
    .from("posts")
    .insert({
      title,
      slug: slug || null,
      excerpt: excerpt || null,
      content: body || null,
      main_image: featured_image,
      status,
      published_at: publishedAt,
      created_at: now,
      updated_at: now,
      source_name,
      original_url,
      meta_title,
      meta_description,
      canonical_url,
      showcase_data: showcaseData,
      display_options: displayOptions,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createPost]", error);
    return { error: error.message };
  }

  const postId = (data as { id: string } | null)?.id;
  if (postId) {
    if (categoryIds.length > 0) {
      await supabaseServer.from("post_categories").insert(categoryIds.map((category_id) => ({ post_id: postId, category_id })));
    }
    if (tagIds.length > 0) {
      await supabaseServer.from("post_tags").insert(tagIds.map((tag_id) => ({ post_id: postId, tag_id })));
    }
    if (contentTypeIdValid != null) {
      await supabaseServer.from("post_content_types").insert({ post_id: postId, content_type_id: contentTypeIdValid });
    }
  }

  return { id: postId };
}

export async function updatePost(
  id: string,
  formData: FormData
): Promise<{ success?: boolean; message?: string; error?: string }> {
  const supabaseServer = await createClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  if (!user) {
    return { error: "Unauthorized." };
  }

  const title = (formData.get("title") as string)?.trim() ?? null;
  const excerpt = (formData.get("excerpt") as string)?.trim() ?? null;
  const body = formData.get("body") as string;
  const featured_image = (formData.get("featured_image") as string) || null;
  const published_at = (formData.get("published_at") as string)?.trim() || null;
  const slug = (formData.get("slug") as string)?.trim() || null;
  const source_name = (formData.get("source_name") as string)?.trim() || null;
  const original_url = (formData.get("original_url") as string)?.trim() || null;
  const meta_title = (formData.get("meta_title") as string)?.trim() || null;
  const meta_description = (formData.get("meta_description") as string)?.trim() || null;
  const canonical_url = (formData.get("canonical_url") as string)?.trim() || null;
  const categoryIds = (formData.getAll("category_ids") as string[]).map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
  const tagIds = (formData.getAll("tag_ids") as string[]).map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
  const contentTypeIdRaw = formData.get("content_type_id");
  const contentTypeId =
    contentTypeIdRaw != null && String(contentTypeIdRaw).trim() !== ""
      ? parseInt(String(contentTypeIdRaw), 10)
      : null;
  const contentTypeIdValid = contentTypeId != null && !Number.isNaN(contentTypeId) ? contentTypeId : null;

  const showcaseDataRaw = formData.get("showcase_data");
  let showcaseData: unknown[] = [];
  if (showcaseDataRaw != null && String(showcaseDataRaw).trim() !== "") {
    try {
      const parsed = JSON.parse(String(showcaseDataRaw));
      showcaseData = Array.isArray(parsed) ? parsed : [];
    } catch {
      // keep default [] on parse error
    }
  }

  const displayOptionsRaw = formData.get("display_options");
  let displayOptions: Record<string, unknown> = {};
  if (displayOptionsRaw != null && String(displayOptionsRaw).trim() !== "") {
    try {
      const parsed = JSON.parse(String(displayOptionsRaw));
      displayOptions = parsed != null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      // keep default {} on parse error
    }
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    draft_title: title ?? null,
    draft_summary: excerpt ?? null,
    draft_content: body ?? null,
    draft_hero_image: featured_image ?? null,
    slug,
    source_name,
    original_url,
    meta_title,
    meta_description,
    canonical_url,
    showcase_data: showcaseData,
    display_options: displayOptions,
  };
  if (published_at) {
    try {
      payload.published_at = new Date(published_at).toISOString();
    } catch {
      // ignore invalid date
    }
  }

  const client = await createClient();
  const { error } = await client.from("posts").update(payload).eq("id", id);

  if (error) {
    console.error("[updatePost]", error);
    return { error: error.message };
  }

  // Taxonomies: delete then insert
  await client.from("post_categories").delete().eq("post_id", id);
  await client.from("post_tags").delete().eq("post_id", id);
  await client.from("post_content_types").delete().eq("post_id", id);
  if (categoryIds.length > 0) {
    await client.from("post_categories").insert(categoryIds.map((category_id) => ({ post_id: id, category_id })));
  }
  if (tagIds.length > 0) {
    await client.from("post_tags").insert(tagIds.map((tag_id) => ({ post_id: id, tag_id })));
  }
  if (contentTypeIdValid != null) {
    await client.from("post_content_types").insert({ post_id: id, content_type_id: contentTypeIdValid });
  }

  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${id}`);
  revalidatePath(`/admin/preview/${id}`);
  return { success: true, message: "Draft saved" };
}

export async function publishPost(id: string): Promise<{ success: boolean; error?: string }> {
  const client = await createClient();
  const { data: post, error: fetchError } = await client
    .from("posts")
    .select("id, slug, title, excerpt, content, main_image, draft_title, draft_summary, draft_content, draft_hero_image, published_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("[publishPost] fetch", fetchError);
    return { success: false, error: fetchError.message };
  }
  if (!post) {
    return { success: false, error: "Post not found" };
  }

  const raw = post as Record<string, unknown>;
  const draftTitle = raw.draft_title as string | null | undefined;
  const draftSummary = raw.draft_summary as string | null | undefined;
  const draftContent = raw.draft_content as string | null | undefined;
  const draftHero = raw.draft_hero_image as string | null | undefined;

  const payload = {
    title: draftTitle ?? post.title,
    excerpt: draftSummary ?? post.excerpt ?? null,
    content: draftContent ?? post.content ?? null,
    main_image: draftHero ?? post.main_image ?? null,
    status: "published",
    published_at: post.published_at ? post.published_at : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await client.from("posts").update(payload).eq("id", id);
  if (updateError) {
    console.error("[publishPost] update", updateError);
    return { success: false, error: updateError.message };
  }

  const slug = post.slug as string | null;
  if (slug) revalidatePath(`/${slug}`);
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/all");
  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${id}`);
  return { success: true };
}

export async function deletePost(id: string): Promise<{ error?: string }> {
  const supabaseServer = await createClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  if (!user) {
    return { error: "Unauthorized." };
  }

  const client = await createClient();
  const { error } = await client.from("posts").delete().eq("id", id);

  if (error) {
    console.error("[deletePost]", error);
    return { error: error.message };
  }
  return {};
}
