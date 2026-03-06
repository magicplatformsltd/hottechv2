/**
 * Asset localization: download external images (e.g. authory.com) and re-host
 * in Supabase storage, then optionally register in media_items for the Media Command Center.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const AUTHORY_DOMAIN = "authory.com";
export const MEDIA_BUCKET = "all_media";

/** Check if a URL is an external Authory asset we should localize. */
export function isAuthoryUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase().includes(AUTHORY_DOMAIN);
  } catch {
    return false;
  }
}

const IMG_SRC_REGEX = /<img[^>]+src=["']([^"']+)["']/gi;
const URL_REGEX = /https?:\/\/[^\s"'<>)\]]+/g;

/** Extract all URLs from a string that contain authory.com. */
export function extractAuthoryUrlsFromString(str: string | null | undefined): string[] {
  if (!str || typeof str !== "string") return [];
  const urls = new Set<string>();
  // From img src
  let m: RegExpExecArray | null;
  IMG_SRC_REGEX.lastIndex = 0;
  while ((m = IMG_SRC_REGEX.exec(str)) !== null) {
    const u = m[1].trim();
    if (isAuthoryUrl(u)) urls.add(u);
  }
  // From any URL-like pattern
  const matches = str.match(URL_REGEX) ?? [];
  for (const u of matches) {
    const trimmed = u.replace(/[)\]\s]+$/, "").trim();
    if (isAuthoryUrl(trimmed)) urls.add(trimmed);
  }
  return Array.from(urls);
}

/** Recursively extract authory.com URLs from JSON-serializable values. */
export function extractAuthoryUrlsFromJson(val: unknown): string[] {
  const urls = new Set<string>();
  function walk(v: unknown) {
    if (v == null) return;
    if (typeof v === "string") {
      if (isAuthoryUrl(v)) urls.add(v);
      extractAuthoryUrlsFromString(v).forEach((u) => urls.add(u));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === "object") {
      for (const key of Object.keys(v)) {
        walk((v as Record<string, unknown>)[key]);
      }
    }
  }
  walk(val);
  return Array.from(urls);
}

export type PostImageFields = {
  featured_image?: string | null;
  main_image?: string | null;
  draft_hero_image?: string | null;
  content?: string | null;
  showcase_data?: unknown;
};

/** Collect all authory.com URLs from post-like fields. */
export function extractAllAuthoryUrls(fields: PostImageFields): string[] {
  const urls = new Set<string>();
  if (fields.featured_image && isAuthoryUrl(fields.featured_image)) urls.add(fields.featured_image);
  if (fields.main_image && isAuthoryUrl(fields.main_image)) urls.add(fields.main_image);
  if (fields.draft_hero_image && isAuthoryUrl(fields.draft_hero_image)) urls.add(fields.draft_hero_image);
  extractAuthoryUrlsFromString(fields.content ?? undefined).forEach((u) => urls.add(u));
  extractAuthoryUrlsFromJson(fields.showcase_data).forEach((u) => urls.add(u));
  return Array.from(urls);
}

/** Infer MIME type from URL or buffer. */
function getMimeType(url: string, buffer: Buffer): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  // Sniff first bytes
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
  const riff = buffer.toString("ascii", 0, 4);
  if (riff === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return "image/jpeg";
}

/** Safe filename from URL (path segment + extension). */
function filenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split("/").filter(Boolean).pop() ?? "image";
    const sanitized = segment.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    return sanitized || `image-${Date.now()}.jpg`;
  } catch {
    return `image-${Date.now()}.jpg`;
  }
}

/**
 * Download image from URL (server-side). Returns buffer and final URL after redirects.
 */
export async function downloadImage(url: string): Promise<{ buffer: Buffer; finalUrl: string }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; HouseOfTech/1.0; +https://houseoftech.com)",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText} for ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const finalUrl = response.url ?? url;
  return { buffer, finalUrl };
}

/**
 * Upload buffer to Supabase storage and return public URL.
 * Uses MEDIA_BUCKET so assets appear in the same bucket as the Media Command Center.
 */
export async function uploadToSupabaseStorage(
  supabase: SupabaseClient,
  buffer: Buffer,
  mimeType: string,
  suggestedFilename: string
): Promise<{ publicUrl: string; storagePath: string }> {
  const ext = suggestedFilename.includes(".")
    ? suggestedFilename.split(".").pop()?.slice(0, 5) ?? "jpg"
    : "jpg";
  const storagePath = `ingest/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl, storagePath };
}

/**
 * Insert a row into media_items so the asset appears in the 70/30/10 Media Command Center.
 */
export async function addToMediaLibrary(
  supabase: SupabaseClient,
  publicUrl: string,
  filename: string,
  mimeType: string,
  size: number
): Promise<void> {
  const { error } = await supabase.from("media_items").insert({
    filename,
    url: publicUrl,
    mime_type: mimeType,
    size,
  });
  if (error) {
    console.warn("[asset-localization] media_items insert failed (asset still stored):", error.message);
  }
}

/**
 * Download an external image, upload to Supabase, register in media_items, and return the new public URL.
 * If the URL is not an authory.com URL, returns it unchanged.
 */
export async function localizeImageUrl(
  supabase: SupabaseClient,
  externalUrl: string,
  options?: { addToMediaLibrary?: boolean }
): Promise<string> {
  if (!isAuthoryUrl(externalUrl)) return externalUrl;

  const { buffer, finalUrl } = await downloadImage(externalUrl);
  const mimeType = getMimeType(finalUrl, buffer);
  const filename = filenameFromUrl(finalUrl);

  const { publicUrl } = await uploadToSupabaseStorage(supabase, buffer, mimeType, filename);

  if (options?.addToMediaLibrary !== false) {
    await addToMediaLibrary(supabase, publicUrl, filename, mimeType, buffer.length);
  }

  return publicUrl;
}

/**
 * Like localizeImageUrl but returns null on failure (for migration script: log and continue).
 */
export async function localizeImageUrlSafe(
  supabase: SupabaseClient,
  externalUrl: string,
  options?: { addToMediaLibrary?: boolean }
): Promise<string | null> {
  try {
    return await localizeImageUrl(supabase, externalUrl, options);
  } catch {
    return null;
  }
}

/**
 * Build a map of external URL -> localized URL for all authory.com URLs in the given fields.
 * Each URL is downloaded once; duplicates share the same localized URL.
 */
export async function localizeAllAuthoryUrls(
  supabase: SupabaseClient,
  fields: PostImageFields,
  options?: { addToMediaLibrary?: boolean }
): Promise<Map<string, string>> {
  const urls = extractAllAuthoryUrls(fields);
  const map = new Map<string, string>();
  for (const url of urls) {
    if (map.has(url)) continue;
    try {
      const local = await localizeImageUrl(supabase, url, options);
      map.set(url, local);
    } catch (err) {
      console.error("[asset-localization] Failed to localize:", url, err);
      throw err;
    }
  }
  return map;
}

/** Replace all authory URLs in a string with their localized equivalents. */
export function replaceUrlsInString(
  str: string | null | undefined,
  urlMap: Map<string, string>
): string {
  if (!str || typeof str !== "string") return str ?? "";
  let out = str;
  for (const [external, local] of urlMap) {
    out = out.split(external).join(local);
  }
  return out;
}

/** Recursively replace authory URLs in JSON-serializable values. */
export function replaceUrlsInJson(val: unknown, urlMap: Map<string, string>): unknown {
  if (val == null) return val;
  if (typeof val === "string") {
    return replaceUrlsInString(val, urlMap);
  }
  if (Array.isArray(val)) {
    return val.map((v) => replaceUrlsInJson(v, urlMap));
  }
  if (typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(val)) {
      out[key] = replaceUrlsInJson((val as Record<string, unknown>)[key], urlMap);
    }
    return out;
  }
  return val;
}

/** Apply urlMap to all post image fields; returns new object with replaced values. */
export function replaceUrlsInPostFields(
  fields: PostImageFields,
  urlMap: Map<string, string>
): PostImageFields {
  return {
    featured_image:
      fields.featured_image != null ? replaceUrlsInString(fields.featured_image, urlMap) : undefined,
    main_image:
      fields.main_image != null ? replaceUrlsInString(fields.main_image, urlMap) : undefined,
    draft_hero_image:
      fields.draft_hero_image != null
        ? replaceUrlsInString(fields.draft_hero_image, urlMap)
        : undefined,
    content: fields.content != null ? replaceUrlsInString(fields.content, urlMap) : undefined,
    showcase_data:
      fields.showcase_data != null
        ? (replaceUrlsInJson(fields.showcase_data, urlMap) as PostImageFields["showcase_data"])
        : undefined,
  };
}
