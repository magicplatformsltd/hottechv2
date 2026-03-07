import Parser from "rss-parser";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache, unstable_noStore } from "next/cache";
import { parseISO } from "date-fns";
import { supabase } from "./supabase";
import type { FeedItem, SiteSettings } from "./types";

const PLACEHOLDER_IMAGE = "https://placehold.co/600x400/1a1a1a/FFF";
const AUTHORY_FEED_URL = "https://authory.com/hot/rss";

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["enclosure", "enclosure"],
      ["itunes:image", "itunesImage"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

/** Extract first img src from HTML string, or null. */
function extractImageFromContent(html: string | undefined): string | null {
  if (!html || typeof html !== "string") return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

/** Return a clean publisher name from a URL. */
function getPublisherFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("forbes.com")) return "Forbes";
  if (lower.includes("androidcentral.com")) return "Android Central";
  if (lower.includes("techradar.com")) return "TechRadar";
  if (lower.includes("tomsguide.com")) return "Tom's Guide";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "YouTube";
  if (lower.includes("instagram.com")) return "Instagram";
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (!hostname) return "Authory";
    const name = hostname.split(".")[0] ?? hostname;
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  } catch {
    return "Authory";
  }
}

type AuthoryRssItem = Parser.Item & {
  source?: string;
  mediaContent?: unknown;
  mediaThumbnail?: unknown;
  itunesImage?: unknown;
  contentEncoded?: unknown;
};

/** Get image URL from Authory RSS item. */
function getImageFromAuthoryItem(item: AuthoryRssItem): string {
  const itunesImg = item.itunesImage as { href?: string; $?: { href?: string } } | undefined;
  const itunesHref = itunesImg?.href || itunesImg?.$?.href;
  if (itunesHref) return itunesHref;
  const mcAttr = (item.mediaContent as { $?: { url?: string } } | undefined)?.$?.url;
  if (mcAttr && typeof mcAttr === "string") return mcAttr;
  const mcUrl = (item.mediaContent as { url?: string } | undefined)?.url;
  if (mcUrl && typeof mcUrl === "string") return mcUrl;
  const mtAttr = (item.mediaThumbnail as { $?: { url?: string } } | undefined)?.$?.url;
  if (mtAttr && typeof mtAttr === "string") return mtAttr;
  const mtUrl = (item.mediaThumbnail as { url?: string } | undefined)?.url;
  if (mtUrl && typeof mtUrl === "string") return mtUrl;
  const enclosureUrl = item.enclosure?.url;
  if (enclosureUrl && typeof enclosureUrl === "string") return enclosureUrl;
  const html = (item.contentEncoded as string | undefined) ?? item.content;
  const fromContent = extractImageFromContent(typeof html === "string" ? html : undefined);
  if (fromContent) return fromContent;
  return PLACEHOLDER_IMAGE;
}

function mapRssItemToFeedItem(item: AuthoryRssItem, index: number): FeedItem {
  const link = item.link ?? "";
  const linkLower = link.toLowerCase();
  let type: FeedItem["type"];
  if (linkLower.includes("youtube.com") || linkLower.includes("youtu.be")) {
    type = "video";
  } else if (linkLower.includes("instagram.com")) {
    type = "social";
  } else {
    type = "external-article";
  }
  const publisher = getPublisherFromUrl(link);
  const image = getImageFromAuthoryItem(item);
  const date = item.isoDate ?? item.pubDate ?? new Date().toISOString();
  const rawId = item.guid ?? `authory-${index}-${date}`;
  const id = typeof rawId === "string" ? rawId : String(rawId);
  return {
    id,
    title: item.title ?? "Untitled",
    excerpt: item.contentSnippet ?? undefined,
    date,
    type,
    source: "external",
    url: link,
    image,
    publisher,
  };
}

export async function getAuthoryFeed(): Promise<FeedItem[]> {
  try {
    const feed = await parser.parseURL(AUTHORY_FEED_URL);
    const items = feed.items ?? [];
    return items.map((item, index) =>
      mapRssItemToFeedItem(item as AuthoryRssItem, index)
    );
  } catch (err) {
    console.error("[getAuthoryFeed]", err);
    return [];
  }
}

/** Fetch posts by IDs and map to FeedItem[] in the order of ids. */
export async function getPostsByIds(ids: string[]): Promise<FeedItem[]> {
  if (ids.length === 0) return [];
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, slug, excerpt, main_image, featured_image, original_url, published_at, created_at, updated_at, type, source_name")
    .in("id", ids)
    .eq("status", "published")
    .lte("published_at", nowIso);

  if (error) {
    console.error("[getPostsByIds]", error);
    return [];
  }
  const byId = new Map<string, (typeof data)[0]>();
  for (const row of data ?? []) {
    byId.set(row.id, row);
  }
  return ids.filter((id) => byId.has(id)).map((id) => {
    const post = byId.get(id)!;
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
    };
  });
}

/** Filters for smart feed. */
export type SmartFeedFilters = {
  categoryId?: number | null;
  tagId?: number | null;
  typeId?: number | null;
  limit?: number;
};

/** Fetch published posts filtered by category, tag, and/or content type. All filters are AND. */
export async function getSmartFeedPosts(
  filters: SmartFeedFilters
): Promise<FeedItem[]> {
  const categoryId = filters?.categoryId;
  const tagId = filters?.tagId;
  const typeId = filters?.typeId;
  const limitParam = filters?.limit;
  const limitNum = Math.min(
    Math.max(Number(limitParam) || 6, 1),
    24
  );

  const hasCategory = categoryId != null && categoryId !== undefined && Number.isFinite(categoryId);
  const hasTag = tagId != null && tagId !== undefined && Number.isFinite(tagId);
  const hasType = typeId != null && typeId !== undefined && Number.isFinite(typeId);

  let postIds: string[] | null = null;

  if (hasCategory) {
    const { data, error } = await supabase
      .from("post_categories")
      .select("post_id")
      .eq("category_id", categoryId);
    if (error) {
      console.error("[getSmartFeedPosts] category", error);
      return [];
    }
    postIds = (data ?? []).map((r) => String(r.post_id));
  }

  if (hasTag) {
    const { data, error } = await supabase
      .from("post_tags")
      .select("post_id")
      .eq("tag_id", tagId);
    if (error) {
      console.error("[getSmartFeedPosts] tag", error);
      return [];
    }
    const tagPostIds = new Set((data ?? []).map((r) => String(r.post_id)));
    postIds = postIds === null ? [...tagPostIds] : postIds.filter((id) => tagPostIds.has(id));
  }

  if (hasType) {
    const { data, error } = await supabase
      .from("post_content_types")
      .select("post_id")
      .eq("content_type_id", typeId);
    if (error) {
      console.error("[getSmartFeedPosts] type", error);
      return [];
    }
    const typePostIds = new Set((data ?? []).map((r) => String(r.post_id)));
    postIds = postIds === null ? [...typePostIds] : postIds.filter((id) => typePostIds.has(id));
  }

  if (postIds !== null && postIds.length === 0) return [];

  const nowIso = new Date().toISOString();
  let query = supabase
    .from("posts")
    .select("id, title, slug, excerpt, main_image, featured_image, original_url, published_at, created_at, updated_at, source_name")
    .eq("status", "published")
    .lte("published_at", nowIso)
    .order("published_at", { ascending: false })
    .limit(limitNum);

  if (postIds !== null) {
    query = query.in("id", postIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getSmartFeedPosts]", error);
    return [];
  }

  return (data ?? []).map((post) => {
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
    };
  });
}

export type ArchiveResult = {
  title: string;
  description: string;
  posts: FeedItem[];
};

/** Fetch published posts for a taxonomy (category, tag, or content_type) by slug. */
export async function getPostsByTaxonomy(
  type: "category" | "tag" | "content_type",
  slug: string
): Promise<ArchiveResult | null> {
  const s = (slug ?? "").trim();
  if (!s) return null;

  let id: number;
  let name: string;

  if (type === "category") {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name")
      .eq("slug", s)
      .maybeSingle();
    if (error || !data) return null;
    id = data.id;
    name = data.name ?? s;
  } else if (type === "tag") {
    const { data, error } = await supabase
      .from("tags")
      .select("id, name")
      .eq("slug", s)
      .maybeSingle();
    if (error || !data) return null;
    id = data.id;
    name = data.name ?? s;
  } else {
    const { data, error } = await supabase
      .from("content_types")
      .select("id, name")
      .eq("slug", s)
      .maybeSingle();
    if (error || !data) return null;
    id = data.id;
    name = data.name ?? s;
  }

  let postIds: string[] = [];
  if (type === "category") {
    const { data, error } = await supabase
      .from("post_categories")
      .select("post_id")
      .eq("category_id", id);
    if (error) return null;
    postIds = (data ?? []).map((r) => String(r.post_id));
  } else if (type === "tag") {
    const { data, error } = await supabase
      .from("post_tags")
      .select("post_id")
      .eq("tag_id", id);
    if (error) return null;
    postIds = (data ?? []).map((r) => String(r.post_id));
  } else {
    const { data, error } = await supabase
      .from("post_content_types")
      .select("post_id")
      .eq("content_type_id", id);
    if (error) return null;
    postIds = (data ?? []).map((r) => String(r.post_id));
  }

  if (postIds.length === 0) {
    return { title: name, description: `All our latest ${name}.`, posts: [] };
  }

  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("posts")
    .select("id, title, slug, excerpt, main_image, featured_image, original_url, published_at, created_at, updated_at, source_name")
    .in("id", postIds)
    .eq("status", "published")
    .lte("published_at", nowIso)
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[getPostsByTaxonomy]", error);
    return null;
  }

  const posts: FeedItem[] = (rows ?? []).map((post) => {
    const date = post.published_at ?? post.created_at ?? post.updated_at ?? new Date().toISOString();
    const hasExternalUrl = post.original_url != null && String(post.original_url).trim() !== "";
    const url = hasExternalUrl ? String(post.original_url) : `/${post.slug ?? post.id}`;
    const image = post.featured_image ?? post.main_image ?? undefined;
    const feedType = hasExternalUrl ? ("external-article" as const) : ("post" as const);
    return {
      id: post.id,
      title: post.title ?? "Untitled",
      excerpt: post.excerpt ?? undefined,
      date,
      type: feedType,
      source: "internal" as const,
      url,
      image,
      publisher: post.source_name ?? "House of Tech",
    };
  });

  const description =
    type === "category"
      ? `All our latest ${name}.`
      : type === "tag"
        ? `All posts tagged ${name}.`
        : `All our latest ${name}.`;

  return { title: name, description, posts };
}

/** Fetch only taxonomy name by slug (for metadata). */
export async function getTaxonomyBySlug(
  type: "category" | "tag" | "content_type",
  slug: string
): Promise<{ name: string } | null> {
  const s = (slug ?? "").trim();
  if (!s) return null;
  const table =
    type === "category"
      ? "categories"
      : type === "tag"
        ? "tags"
        : "content_types";
  const { data, error } = await supabase
    .from(table)
    .select("name")
    .eq("slug", s)
    .maybeSingle();
  if (error || !data) return null;
  return { name: data.name ?? s };
}

/** Published posts from Supabase for the unified feed. */
export async function getSupabasePosts(): Promise<FeedItem[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, slug, excerpt, main_image, featured_image, original_url, published_at, created_at, updated_at, type, source_name")
    .eq("status", "published")
    .lte("published_at", nowIso)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getSupabasePosts]", error);
    return [];
  }

  return (data ?? []).map((post) => {
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
    };
  });
}

export type SupabasePost = {
  id: string;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  body: string | null;
  featured_image: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  published_at?: string | null;
  source_name?: string | null;
  /** Content type slug (e.g. showcase_people, showcase_products) for showcase rendering. */
  content_type_slug?: string | null;
  /** Showcase items for Best of / Awards. */
  showcase_data?: unknown[];
  /** Display options (e.g. hide_header). */
  display_options?: Record<string, unknown>;
  /** Author user id (for draft preview access). */
  user_id?: string | null;
};

/** Published post by primary_product_id and post_type (e.g. 'reviews'). Direct columns, no junction join. */
export async function getPostByPrimaryProductAndType(
  primaryProductId: string,
  postType: string
): Promise<SupabasePost | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, slug, excerpt, content, main_image, status, created_at, updated_at, published_at, source_name, showcase_data, display_options, user_id")
    .eq("primary_product_id", primaryProductId)
    .eq("post_type", postType)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("[getPostByPrimaryProductAndType]", error);
    return null;
  }
  if (!data) return null;

  let content_type_slug: string | null = null;
  const { data: pct } = await supabase
    .from("post_content_types")
    .select("content_type_id")
    .eq("post_id", data.id)
    .maybeSingle();
  if (pct?.content_type_id != null) {
    const { data: ct } = await supabase
      .from("content_types")
      .select("slug")
      .eq("id", pct.content_type_id)
      .maybeSingle();
    content_type_slug = ct?.slug ?? null;
  }

  const showcaseData = data.showcase_data;
  const displayOptions = data.display_options;
  return {
    ...data,
    body: data.content != null ? String(data.content) : null,
    featured_image: data.main_image != null ? String(data.main_image) : null,
    content_type_slug,
    showcase_data: Array.isArray(showcaseData) ? showcaseData : [],
    display_options: displayOptions != null && typeof displayOptions === "object" && !Array.isArray(displayOptions) ? (displayOptions as Record<string, unknown>) : {},
    user_id: data.user_id != null ? String(data.user_id) : null,
  } as SupabasePost;
}

/** Same as getPostByPrimaryProductAndType but does not filter by status. Use for admin/preview so draft/scheduled reviews can be shown. */
export async function getPostByPrimaryProductAndTypeAnyStatus(
  primaryProductId: string,
  postType: string
): Promise<SupabasePost | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, slug, excerpt, content, main_image, status, created_at, updated_at, published_at, source_name, showcase_data, display_options, user_id")
    .eq("primary_product_id", primaryProductId)
    .eq("post_type", postType)
    .maybeSingle();

  if (error) {
    console.error("[getPostByPrimaryProductAndTypeAnyStatus]", error);
    return null;
  }
  if (!data) return null;

  let content_type_slug: string | null = null;
  const { data: pct } = await supabase
    .from("post_content_types")
    .select("content_type_id")
    .eq("post_id", data.id)
    .maybeSingle();
  if (pct?.content_type_id != null) {
    const { data: ct } = await supabase
      .from("content_types")
      .select("slug")
      .eq("id", pct.content_type_id)
      .maybeSingle();
    content_type_slug = ct?.slug ?? null;
  }

  const showcaseData = data.showcase_data;
  const displayOptions = data.display_options;
  return {
    ...data,
    body: data.content != null ? String(data.content) : null,
    featured_image: data.main_image != null ? String(data.main_image) : null,
    content_type_slug,
    showcase_data: Array.isArray(showcaseData) ? showcaseData : [],
    display_options: displayOptions != null && typeof displayOptions === "object" && !Array.isArray(displayOptions) ? (displayOptions as Record<string, unknown>) : {},
    user_id: data.user_id != null ? String(data.user_id) : null,
  } as SupabasePost;
}

export type LatestPostItem = { id: string; title: string | null; slug: string | null; excerpt: string | null; published_at: string | null };

/** Latest published posts for category hub "latest news". Direct query, no joins. */
export async function getLatestPublishedPosts(limit: number = 10): Promise<LatestPostItem[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, slug, excerpt, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(Math.max(1, limit));

  if (error) {
    console.error("[getLatestPublishedPosts]", error);
    return [];
  }
  return (data ?? []) as LatestPostItem[];
}

export async function getPostBySlug(slug: string): Promise<SupabasePost | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, slug, excerpt, content, main_image, status, created_at, updated_at, published_at, source_name, showcase_data, display_options, user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[getPostBySlug]", error);
    return null;
  }
  if (!data) return null;

  let content_type_slug: string | null = null;
  const { data: pct } = await supabase
    .from("post_content_types")
    .select("content_type_id")
    .eq("post_id", data.id)
    .maybeSingle();
  if (pct?.content_type_id != null) {
    const { data: ct } = await supabase
      .from("content_types")
      .select("slug")
      .eq("id", pct.content_type_id)
      .maybeSingle();
    content_type_slug = ct?.slug ?? null;
  }

  const showcaseData = data.showcase_data;
  const displayOptions = data.display_options;
  return {
    ...data,
    body: data.content != null ? String(data.content) : null,
    featured_image: data.main_image != null ? String(data.main_image) : null,
    content_type_slug,
    showcase_data: Array.isArray(showcaseData) ? showcaseData : [],
    display_options: displayOptions != null && typeof displayOptions === "object" && !Array.isArray(displayOptions) ? (displayOptions as Record<string, unknown>) : {},
    user_id: data.user_id != null ? String(data.user_id) : null,
  } as SupabasePost;
}

/** Post by ID for admin draft preview. Returns SupabasePost shape with draft_* overrides. No status filter — fetches regardless of published state. */
export async function getPostByIdForPreview(id: string): Promise<SupabasePost | null> {
  return getPostByIdForPreviewWithClient(supabase, id);
}

/** Same as getPostByIdForPreview but uses the given client (e.g. server createClient() with session for RLS). */
export async function getPostByIdForPreviewWithClient(
  client: SupabaseClient,
  id: string
): Promise<SupabasePost | null> {
  unstable_noStore();
  const { data, error } = await client
    .from("posts")
    .select("id, title, slug, excerpt, content, main_image, status, created_at, updated_at, published_at, source_name, showcase_data, display_options, user_id, draft_title, draft_summary, draft_content, draft_hero_image")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getPostByIdForPreview]", error);
    return null;
  }
  if (!data) return null;

  let content_type_slug: string | null = null;
  const { data: pct } = await client
    .from("post_content_types")
    .select("content_type_id")
    .eq("post_id", data.id)
    .maybeSingle();
  if (pct?.content_type_id != null) {
    const { data: ct } = await client
      .from("content_types")
      .select("slug")
      .eq("id", pct.content_type_id)
      .maybeSingle();
    content_type_slug = ct?.slug ?? null;
  }

  const raw = data as Record<string, unknown>;
  const draftTitle = raw.draft_title as string | null | undefined;
  const draftSummary = raw.draft_summary as string | null | undefined;
  const draftContent = raw.draft_content as string | null | undefined;
  const draftHero = raw.draft_hero_image as string | null | undefined;

  const showcaseData = data.showcase_data;
  const displayOptions = data.display_options;
  return {
    ...data,
    title: draftTitle ?? data.title,
    excerpt: draftSummary ?? data.excerpt ?? null,
    body: draftContent != null ? String(draftContent) : (data.content != null ? String(data.content) : null),
    featured_image: draftHero != null ? String(draftHero) : (data.main_image != null ? String(data.main_image) : null),
    content_type_slug,
    showcase_data: Array.isArray(showcaseData) ? showcaseData : [],
    display_options: displayOptions != null && typeof displayOptions === "object" && !Array.isArray(displayOptions) ? (displayOptions as Record<string, unknown>) : {},
    user_id: data.user_id != null ? String(data.user_id) : null,
  } as SupabasePost;
}

/** Primary category name for a post (first linked category). For SEO title template {{category}}. */
export async function getPostPrimaryCategoryName(
  postId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("post_categories")
    .select("category_id")
    .eq("post_id", postId)
    .limit(1)
    .maybeSingle();
  if (error || !data?.category_id) return null;
  const { data: cat, error: catError } = await supabase
    .from("categories")
    .select("name")
    .eq("id", data.category_id)
    .maybeSingle();
  if (catError || !cat?.name) return null;
  return String(cat.name);
}

export async function getUnifiedFeed(): Promise<FeedItem[]> {
  const [internalPosts, authoryItems] = await Promise.all([
    getSupabasePosts(),
    getAuthoryFeed(),
  ]);
  const merged = [...internalPosts, ...authoryItems];
  const sorted = merged.sort((a, b) => {
    const dateA = parseISO(a.date).getTime();
    const dateB = parseISO(b.date).getTime();
    return dateB - dateA;
  });
  return sorted;
}

/** Sent newsletter list item (archive index). */
export type SentNewsletterItem = {
  id: string;
  subject: string | null;
  slug: string | null;
  sent_at: string | null;
  /** From preview_text, or snippet from content. */
  description: string | null;
  preview_text: string | null;
  featured_image: string | null;
};

/** Public newsletter by slug (for website archive / web view). */
export type NewsletterPublic = {
  id: string;
  subject: string | null;
  slug: string | null;
  preview_text: string | null;
  content: string | null;
  featured_image: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  sent_at: string | null;
};

/** Fetch all sent newsletters for the public archive, ordered by sent_at desc. */
export async function getSentNewsletters(): Promise<SentNewsletterItem[]> {
  const { data, error } = await supabase
    .from("newsletters")
    .select("id, subject, slug, sent_at, preview_text, content, featured_image")
    .eq("status", "sent")
    .order("sent_at", { ascending: false });

  if (error) {
    console.error("[getSentNewsletters]", error);
    return [];
  }
  const rows = (data ?? []) as { id: string; subject: string | null; slug: string | null; sent_at: string | null; preview_text: string | null; content: string | null; featured_image: string | null }[];
  return rows.map((row) => {
    const preview_text = row.preview_text?.trim() || null;
    let description: string | null = preview_text;
    if (!description && row.content) {
      const raw = typeof row.content === "string" ? row.content : (row.content != null ? String(row.content) : "");
      const stripped = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      description = stripped.slice(0, 160) + (stripped.length > 160 ? "…" : "") || null;
    }
    return {
      id: row.id,
      subject: row.subject,
      slug: row.slug,
      sent_at: row.sent_at,
      description,
      preview_text,
      featured_image: row.featured_image?.trim() || null,
    };
  });
}

/** Fetch newsletter by slug (any status). Page decides access for drafts. */
export async function getNewsletterBySlug(slug: string): Promise<NewsletterPublic | null> {
  const { data, error } = await supabase
    .from("newsletters")
    .select("id, subject, slug, preview_text, content, featured_image, status, created_at, updated_at, sent_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[getNewsletterBySlug]", error);
    return null;
  }
  if (!data) return null;
  const content = data.content;
  const contentStr =
    content == null ? null : typeof content === "string" ? content : JSON.stringify(content);
  return {
    ...data,
    content: contentStr,
    featured_image: data.featured_image?.trim() || null,
  } as NewsletterPublic;
}

/** Fetch the singleton site settings (id=1). Cached for 60s; invalidate with revalidateTag("site-settings"). */
export async function getSiteSettings(): Promise<SiteSettings | null> {
  return unstable_cache(
    async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) {
        console.error("Error fetching settings:", error);
        return null;
      }
      return data as SiteSettings | null;
    },
    ["site-settings"],
    { revalidate: 60, tags: ["site-settings"] }
  )();
}

/** Post slug + updated_at for sitemap. */
export async function getPostSlugsForSitemap(): Promise<
  { slug: string; updated_at: string | null }[]
> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("posts")
    .select("slug, updated_at, id")
    .eq("status", "published")
    .lte("published_at", nowIso);
  if (error) {
    console.error("[getPostSlugsForSitemap]", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    slug: (r.slug ?? r.id) as string,
    updated_at: r.updated_at ?? null,
  })) as { slug: string; updated_at: string | null }[];
}

/** Taxonomy slugs for sitemap. */
export async function getTaxonomySlugsForSitemap(
  type: "category" | "tag" | "content_type"
): Promise<string[]> {
  const table =
    type === "category"
      ? "categories"
      : type === "tag"
        ? "tags"
        : "content_types";
  const { data, error } = await supabase.from(table).select("slug");
  if (error) {
    console.error("[getTaxonomySlugsForSitemap]", error);
    return [];
  }
  return (data ?? [])
    .map((r) => r.slug)
    .filter((s): s is string => typeof s === "string" && s.length > 0);
}
