import Parser from "rss-parser";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";

/** AI returns names; we resolve to DB IDs using pre-fetched maps. */
type NameBasedClassification = {
  category?: string;
  tags?: string[];
  content_type?: string | null;
};

function normalizeName(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase();
}

const AUTHORY_FEED_URL = "https://authory.com/hot/rss?count=100";
const PLACEHOLDER_IMAGE = "https://placehold.co/600x400/1a1a1a/FFF";

const ALLOWED_ADMIN_EMAILS = ["web@nirave.co"];

type AuthoryRssItem = Parser.Item & {
  source?: string;
  mediaContent?: unknown;
  mediaThumbnail?: unknown;
  itunesImage?: unknown;
  contentEncoded?: unknown;
  enclosure?: { url?: string };
};

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

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}

/** URL-safe slug from title (lowercase, spaces to dashes, strip non-alphanumeric). */
function slugify(title: string, suffix?: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const slug = base || "post";
  return suffix ? `${slug}-${suffix}` : slug;
}

/** Extract last path segment from URL as slug (e.g. .../my-cool-post/ → my-cool-post). */
function extractSlugFromUrl(url: string, titleFallback: string): string {
  if (!url || typeof url !== "string") return slugify(titleFallback);
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.replace(/\/$/, "").split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && /^[a-z0-9-]+$/i.test(last)) return last.toLowerCase();
  } catch {
    // ignore
  }
  return slugify(titleFallback);
}

/** Call OpenAI to classify article by NAME. Returns default (e.g. Consumer Tech) on parse failure or missing API key. */
async function classifyContent(
  title: string,
  summary: string,
  categoryNamesList: string,
  tagNamesList: string,
  contentTypeNamesList: string,
  defaultCategoryName: string
): Promise<NameBasedClassification> {
  const fallback: NameBasedClassification = {
    category: defaultCategoryName,
    tags: [],
    content_type: null,
  };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[ingest] OPENAI_API_KEY missing; using default category.");
    return fallback;
  }
  try {
    const client = new OpenAI({ apiKey });
    const userContent = `Article: ${title} - ${summary || "(no summary)"}

Allowed Categories: ${categoryNamesList}
Allowed Tags: ${tagNamesList}
Allowed Content Types: ${contentTypeNamesList}

Match the article to the best category and optional tags/content type. Use EXACTLY the names from the lists above.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a CMS content classifier. Use EXACTLY the provided list of Categories and Tags. Return JSON only in this format: { \"category\": \"Name\", \"tags\": [\"Tag1\", \"Tag2\"], \"content_type\": \"Name\" }. category must be one of the Allowed Categories. tags must be a subset of Allowed Tags. content_type must be one of the Allowed Content Types or null. Do not invent new names.",
        },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw) as NameBasedClassification;
      return parsed;
    } catch (parseErr) {
      console.warn("[ingest] OpenAI response JSON.parse failed, using default category:", parseErr);
      return fallback;
    }
  } catch (err) {
    console.warn("[ingest] OpenAI classification failed:", err);
    return fallback;
  }
}

export async function GET() {
  const headersList = await headers();
  const isCron = headersList.get("x-vercel-cron") === "1";

  // Allow manual syncing from Admin panel when user's email is in the allowed list
  let isAdmin = false;
  if (!isCron) {
    const supabaseAuth = await createServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    const email = user?.email?.toLowerCase().trim();
    isAdmin = !!user && !!email && ALLOWED_ADMIN_EMAILS.includes(email);
  }

  if (!isCron && !isAdmin) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
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

    // Task 1: Pre-fetch database metadata (before looping)
    const [catRes, tagRes, ctRes] = await Promise.all([
      supabase.from("categories").select("id, name").order("name"),
      supabase.from("tags").select("id, name").order("name"),
      supabase.from("content_types").select("id, name, slug").order("name"),
    ]);
    const categories = (catRes.data ?? []) as { id: number; name: string | null }[];
    const tags = (tagRes.data ?? []) as { id: number; name: string | null }[];
    const contentTypes = (ctRes.data ?? []) as { id: number; name: string | null; slug?: string | null }[];

    const validCategories = new Map<string, number>();
    for (const r of categories) {
      const n = (r.name ?? "").trim();
      if (n) validCategories.set(normalizeName(n), r.id);
    }
    const validTags = new Map<string, number>();
    for (const r of tags) {
      const n = (r.name ?? "").trim();
      if (n) validTags.set(normalizeName(n), r.id);
    }
    const validContentTypes = new Map<string, number>();
    for (const r of contentTypes) {
      const n = (r.name ?? "").trim();
      if (n) validContentTypes.set(normalizeName(n), r.id);
    }

    const defaultCategory =
      categories.find((r) => normalizeName(r.name) === "consumer tech") ?? categories[0];
    const defaultCategoryName = defaultCategory?.name?.trim() ?? "";
    const defaultCategoryId = defaultCategory?.id ?? null;

    const categoryNamesList = categories.map((r) => r.name ?? "").filter(Boolean).join(", ");
    const tagNamesList = tags.map((r) => r.name ?? "").filter(Boolean).join(", ");
    const contentTypeNamesList = contentTypes.map((r) => r.name ?? "").filter(Boolean).join(", ");

    // Step 1: Fetch & Sanitize
    const response = await fetch(AUTHORY_FEED_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok)
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    const xmlText = await response.text();
    console.log("Raw Feed Start:", xmlText.substring(0, 200));
    const cleanXml = xmlText.replace(/&(?!(?:apos|quot|[gl]t|amp);|#)/g, "&amp;");
    console.log("Feed fetched and sanitized");

    // Step 2: Parse
    const feed = await parser.parseString(cleanXml);
    const items = (feed.items ?? []) as AuthoryRssItem[];
    const itemsToProcess = items.slice(0, 100);
    let added = 0;
    let skipped = 0;

    // Step 3: Loop & Upsert (limit 100; duplicate check by guid/original_url/slug)
    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      const guid = item.guid ?? item.link ?? null;
      if (!guid) continue;

      const link = item.link ?? "";
      const guidStr = typeof guid === "string" ? guid : String(guid);

      const { data: existingByGuid } = await supabase
        .from("posts")
        .select("id")
        .eq("guid", guidStr)
        .maybeSingle();
      if (existingByGuid) {
        skipped++;
        continue;
      }
      if (link) {
        const { data: existingByUrl } = await supabase
          .from("posts")
          .select("id")
          .eq("original_url", link)
          .maybeSingle();
        if (existingByUrl) {
          skipped++;
          continue;
        }
      }

      const title = item.title?.trim() ?? "Untitled";
      const slugBase = extractSlugFromUrl(link, title);
      const slugSuffix = guidStr.slice(-8).replace(/[^a-z0-9]/gi, "") || Date.now().toString(36);
      let slug = slugBase ? `${slugBase}-${slugSuffix}` : slugify(title, slugSuffix);

      const { data: slugExists } = await supabase
        .from("posts")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (slugExists) {
        slug = slugBase ? `${slugBase}-${slugSuffix}-${Date.now().toString(36)}` : slugify(title, `${slugSuffix}-${Date.now().toString(36)}`);
      }

      const rawDate = item.isoDate ?? new Date().toISOString();
      const published_at = new Date(rawDate).toISOString();
      const snippet = item.contentSnippet?.trim() ?? null;
      const featured_image = getImageFromAuthoryItem(item);
      const original_url = link || null;

      if (i === 0) {
        console.log("[ingest] First item — Date:", published_at, "Image:", featured_image);
      }

      const { data: newPost, error } = await supabase
        .from("posts")
        .insert({
          title,
          slug,
          featured_image,
          main_image: featured_image,
          draft_hero_image: featured_image,
          source_name: getPublisherFromUrl(link),
          original_url,
          excerpt: snippet,
          summary: snippet,
          content: "",
          published_at,
          created_at: published_at,
          status: "published",
          guid: guidStr,
          meta_title: title,
          meta_description: snippet,
          canonical_url: link || null,
          type: "external",
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          skipped++;
          continue;
        }
        console.error("[ingest] post insert error:", error);
        continue;
      }
      added++;
      const postId = (newPost as { id: string })?.id;
      if (!postId) continue;

      // AI classification (returns names; we resolve to IDs with strict matching)
      const classification = await classifyContent(
        title,
        snippet ?? "",
        categoryNamesList,
        tagNamesList,
        contentTypeNamesList,
        defaultCategoryName
      );

      const categoryId =
        (classification.category != null && validCategories.get(normalizeName(classification.category))) ??
        defaultCategoryId;

      const tagIds: number[] = [];
      if (Array.isArray(classification.tags)) {
        for (const t of classification.tags) {
          const id = validTags.get(normalizeName(t));
          if (id != null) tagIds.push(id);
        }
      }

      const contentTypeId =
        classification.content_type != null
          ? validContentTypes.get(normalizeName(classification.content_type)) ?? null
          : null;

      if (categoryId != null) {
        await supabase.from("post_categories").insert({
          post_id: postId,
          category_id: categoryId,
        });
      }
      if (tagIds.length > 0) {
        await supabase.from("post_tags").insert(
          tagIds.map((tag_id) => ({ post_id: postId, tag_id }))
        );
      }
      if (contentTypeId != null) {
        await supabase.from("post_content_types").insert({
          post_id: postId,
          content_type_id: contentTypeId,
        });
      }
    }

    return NextResponse.json({ success: true, added, skipped });
  } catch (e) {
    console.error("[ingest]", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Ingest failed" },
      { status: 500 }
    );
  }
}
