import type {
  SponsorBlockData,
  ImageGalleryData,
  ImageComparisonData,
} from "@/lib/types/post";
import { DEFAULT_SPONSOR_BLOCK_DATA } from "@/lib/types/post";

export type PostBodySegment =
  | { type: "html"; content: string }
  | { type: "sponsor"; data: SponsorBlockData }
  | { type: "imageGallery"; data: ImageGalleryData }
  | { type: "imageComparison"; data: ImageComparisonData };

/** Decode HTML entities in attribute value so JSON.parse works. */
function decodeAttrValue(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Finds sponsor block divs in HTML and extracts data-sponsor JSON.
 * Handles attribute order (data-type / data-sponsor either way) and HTML entities.
 */
function extractSponsorBlocks(
  html: string
): { segments: PostBodySegment[]; sponsorData: SponsorBlockData[] } {
  const sponsorData: SponsorBlockData[] = [];
  const placeholder = "___SPONSOR_PLACEHOLDER___";

  // Attribute order can be data-type then data-sponsor, or the reverse
  const sponsorBlockRegex =
    /<div\s[^>]*(?:data-type="sponsor-block"[^>]*data-sponsor="((?:[^"\\]|\\.)*)"|data-sponsor="((?:[^"\\]|\\.)*)"[^>]*data-type="sponsor-block")[^>]*>[\s\S]*?<\/div>/gi;

  let lastIndex = 0;
  const parts: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = sponsorBlockRegex.exec(html)) !== null) {
    const fullMatch = match[0];
    const rawJson = (match[1] ?? match[2] ?? "").replace(/\\"/g, '"');
    const jsonStr = decodeAttrValue(rawJson);
    try {
      const data = JSON.parse(jsonStr) as SponsorBlockData;
      sponsorData.push({ ...DEFAULT_SPONSOR_BLOCK_DATA, ...data });
      parts.push(html.slice(lastIndex, match.index), placeholder);
      lastIndex = match.index + fullMatch.length;
    } catch {
      parts.push(html.slice(lastIndex, match.index), fullMatch);
      lastIndex = match.index + fullMatch.length;
    }
  }

  if (lastIndex === 0 && sponsorData.length === 0) {
    return { segments: [{ type: "html", content: html }], sponsorData: [] };
  }

  parts.push(html.slice(lastIndex));

  const segments: PostBodySegment[] = [];
  let sponsorIndex = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === placeholder) {
      segments.push({ type: "sponsor", data: sponsorData[sponsorIndex++] });
    } else if (part) {
      segments.push({ type: "html", content: part });
    }
  }

  return { segments, sponsorData };
}

type CustomBlockSegment =
  | { type: "html"; content: string }
  | { type: "imageGallery"; data: ImageGalleryData }
  | { type: "imageComparison"; data: ImageComparisonData };

/** Extract image-gallery and image-comparison blocks from HTML, preserving order. */
function extractGalleryAndComparisonBlocks(html: string): CustomBlockSegment[] {
  const blocks: { index: number; type: "imageGallery" | "imageComparison"; data: unknown; length: number }[] = [];

  const galleryRegex =
    /<div\s[^>]*(?:data-type="image-gallery"[^>]*data-gallery="((?:[^"\\]|\\.)*)"|data-gallery="((?:[^"\\]|\\.)*)"[^>]*data-type="image-gallery")[^>]*>[\s\S]*?<\/div>/gi;
  let m: RegExpExecArray | null;
  while ((m = galleryRegex.exec(html)) !== null) {
    const rawJson = (m[1] ?? m[2] ?? "").replace(/\\"/g, '"');
    try {
      const data = JSON.parse(decodeAttrValue(rawJson)) as ImageGalleryData;
      blocks.push({ index: m.index, type: "imageGallery", data, length: m[0].length });
    } catch {
      /* skip invalid */
    }
  }

  const comparisonRegex =
    /<div\s[^>]*(?:data-type="image-comparison"[^>]*data-comparison="((?:[^"\\]|\\.)*)"|data-comparison="((?:[^"\\]|\\.)*)"[^>]*data-type="image-comparison")[^>]*>[\s\S]*?<\/div>/gi;
  while ((m = comparisonRegex.exec(html)) !== null) {
    const rawJson = (m[1] ?? m[2] ?? "").replace(/\\"/g, '"');
    try {
      const data = JSON.parse(decodeAttrValue(rawJson)) as ImageComparisonData;
      blocks.push({ index: m.index, type: "imageComparison", data, length: m[0].length });
    } catch {
      /* skip invalid */
    }
  }

  blocks.sort((a, b) => a.index - b.index);

  const result: CustomBlockSegment[] = [];
  let lastIndex = 0;
  for (const block of blocks) {
    if (block.index > lastIndex) {
      result.push({ type: "html", content: html.slice(lastIndex, block.index) });
    }
    result.push(
      block.type === "imageGallery"
        ? { type: "imageGallery", data: block.data as ImageGalleryData }
        : { type: "imageComparison", data: block.data as ImageComparisonData }
    );
    lastIndex = block.index + block.length;
  }
  if (lastIndex < html.length) {
    result.push({ type: "html", content: html.slice(lastIndex) });
  }
  if (blocks.length === 0) {
    return [{ type: "html", content: html }];
  }
  return result;
}

/**
 * Parse post body HTML into segments: raw HTML, sponsor, image gallery, and image comparison blocks.
 * Use with BlockRenderer so custom blocks render as their respective React components.
 */
export function parsePostBody(html: string): PostBodySegment[] {
  const sponsorSegments = extractSponsorBlocks(html).segments;
  const result: PostBodySegment[] = [];
  for (const seg of sponsorSegments) {
    if (seg.type === "sponsor") {
      result.push(seg);
    } else if (seg.type === "html" && seg.content) {
      result.push(...extractGalleryAndComparisonBlocks(seg.content));
    } else if (seg.type === "html") {
      result.push(seg);
    }
  }
  return result;
}
