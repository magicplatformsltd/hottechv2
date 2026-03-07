import type {
  SponsorBlockData,
  ImageGalleryData,
  ImageComparisonData,
  PullQuoteData,
  KeyTakeawaysData,
  ProductBoxBlockData,
  ProductBoxBlockConfig,
} from "@/lib/types/post";
import { DEFAULT_PULL_QUOTE_DATA } from "@/lib/types/post";
import { DEFAULT_SPONSOR_BLOCK_DATA } from "@/lib/types/post";

export type PostBodySegment =
  | { type: "html"; content: string }
  | { type: "sponsor"; data: SponsorBlockData }
  | { type: "imageGallery"; data: ImageGalleryData }
  | { type: "imageComparison"; data: ImageComparisonData }
  | { type: "pullQuote"; data: PullQuoteData }
  | { type: "keyTakeaways"; data: KeyTakeawaysData }
  | { type: "productBox"; data: ProductBoxBlockData };

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
  | { type: "imageComparison"; data: ImageComparisonData }
  | { type: "pullQuote"; data: PullQuoteData }
  | { type: "keyTakeaways"; data: KeyTakeawaysData };

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

type PullQuoteKeyTakeawaysSegment =
  | { type: "html"; content: string }
  | { type: "pullQuote"; data: PullQuoteData }
  | { type: "keyTakeaways"; data: KeyTakeawaysData };

/** Extract pull-quote and key-takeaways blocks from HTML. */
function extractPullQuoteAndKeyTakeaways(html: string): PullQuoteKeyTakeawaysSegment[] {
  const blocks: { index: number; type: "pullQuote" | "keyTakeaways"; data: PullQuoteData | KeyTakeawaysData; length: number }[] = [];

  const pullQuoteRegex =
    /<div\s[^>]*(?:data-type="pull-quote"[^>]*data-pull-quote="((?:[^"\\]|\\.)*)"|data-pull-quote="((?:[^"\\]|\\.)*)"[^>]*data-type="pull-quote")[^>]*>[\s\S]*?<\/div>/gi;
  let m: RegExpExecArray | null;
  while ((m = pullQuoteRegex.exec(html)) !== null) {
    const rawJson = (m[1] ?? m[2] ?? "").replace(/\\"/g, '"');
    try {
      const data = JSON.parse(decodeAttrValue(rawJson)) as PullQuoteData;
      blocks.push({
        index: m.index,
        type: "pullQuote",
        data: { ...DEFAULT_PULL_QUOTE_DATA, ...data },
        length: m[0].length,
      });
    } catch {
      /* skip invalid */
    }
  }

  const keyTakeawaysRegex =
    /<div\s[^>]*(?:data-type="key-takeaways"[^>]*data-key-takeaways="((?:[^"\\]|\\.)*)"|data-key-takeaways="((?:[^"\\]|\\.)*)"[^>]*data-type="key-takeaways")[^>]*>[\s\S]*?<\/div>/gi;
  while ((m = keyTakeawaysRegex.exec(html)) !== null) {
    const rawJson = (m[1] ?? m[2] ?? "").replace(/\\"/g, '"');
    try {
      const data = JSON.parse(decodeAttrValue(rawJson)) as KeyTakeawaysData;
      blocks.push({
        index: m.index,
        type: "keyTakeaways",
        data: { items: Array.isArray(data.items) ? data.items : [""] },
        length: m[0].length,
      });
    } catch {
      /* skip invalid */
    }
  }

  blocks.sort((a, b) => a.index - b.index);

  const result: PullQuoteKeyTakeawaysSegment[] = [];
  let lastIndex = 0;
  for (const block of blocks) {
    if (block.index > lastIndex) {
      result.push({ type: "html", content: html.slice(lastIndex, block.index) });
    }
    result.push(
      block.type === "pullQuote"
        ? { type: "pullQuote", data: block.data as PullQuoteData }
        : { type: "keyTakeaways", data: block.data as KeyTakeawaysData }
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

/** Find the end index of the div starting at startIndex (after the opening tag). */
function findMatchingDivEnd(html: string, startIndex: number): number {
  let depth = 1;
  let i = startIndex;
  const len = html.length;
  while (i < len && depth > 0) {
    const open = html.indexOf("<div", i);
    const close = html.indexOf("</div>", i);
    if (close === -1) break;
    if (open !== -1 && open < close) {
      depth++;
      i = open + 4;
    } else {
      depth--;
      if (depth === 0) return close + 6;
      i = close + 6;
    }
  }
  return startIndex;
}

/** Extract product-box blocks from HTML. */
function extractProductBoxBlocks(html: string): { index: number; data: ProductBoxBlockData; length: number }[] {
  const blocks: { index: number; data: ProductBoxBlockData; length: number }[] = [];
  const productBoxOpenRegex = /<div\s[^>]*data-type="product-box"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = productBoxOpenRegex.exec(html)) !== null) {
    const tag = m[0];
    const idMatch = tag.match(/data-product-id="([^"]*)"/);
    const nameMatch = tag.match(/data-product-name="([^"]*)"/);
    const configMatch = tag.match(/data-product-config="((?:[^"\\]|\\.)*)"/);
    const productId = idMatch?.[1] ?? "";
    const productName = nameMatch?.[1] ?? "";
    let config: ProductBoxBlockConfig = {};
    if (configMatch?.[1]) {
      try {
        config = JSON.parse(decodeAttrValue(configMatch[1].replace(/\\"/g, '"'))) as ProductBoxBlockConfig;
      } catch {
        /* use empty config */
      }
    }
    const endTagStart = m.index + tag.length;
    const endIndex = findMatchingDivEnd(html, endTagStart);
    const length = endIndex - m.index;
    blocks.push({
      index: m.index,
      data: { productId, productName, config },
      length,
    });
  }
  return blocks;
}

type WithProductBoxSegment =
  | { type: "html"; content: string }
  | { type: "imageGallery"; data: ImageGalleryData }
  | { type: "imageComparison"; data: ImageComparisonData }
  | { type: "pullQuote"; data: PullQuoteData }
  | { type: "keyTakeaways"; data: KeyTakeawaysData }
  | { type: "productBox"; data: ProductBoxBlockData };

function extractProductBoxSegments(segments: PullQuoteKeyTakeawaysSegment[]): WithProductBoxSegment[] {
  const result: WithProductBoxSegment[] = [];
  for (const seg of segments) {
    if (seg.type !== "html" || !seg.content) {
      result.push(seg as WithProductBoxSegment);
      continue;
    }
    const blocks = extractProductBoxBlocks(seg.content);
    if (blocks.length === 0) {
      result.push(seg as WithProductBoxSegment);
      continue;
    }
    let lastIndex = 0;
    for (const block of blocks) {
      if (block.index > lastIndex) {
        result.push({ type: "html", content: seg.content.slice(lastIndex, block.index) });
      }
      result.push({ type: "productBox", data: block.data });
      lastIndex = block.index + block.length;
    }
    if (lastIndex < seg.content.length) {
      result.push({ type: "html", content: seg.content.slice(lastIndex) });
    }
  }
  return result;
}

/**
 * Parse post body HTML into segments: raw HTML, sponsor, image gallery, image comparison, pull quote, key takeaways, product box.
 * Use with BlockRenderer so custom blocks render as their respective React components.
 */
export function parsePostBody(html: string): PostBodySegment[] {
  const sponsorSegments = extractSponsorBlocks(html).segments;
  const result: PostBodySegment[] = [];
  for (const seg of sponsorSegments) {
    if (seg.type === "sponsor") {
      result.push(seg);
    } else if (seg.type === "html" && seg.content) {
      const gallerySegments = extractGalleryAndComparisonBlocks(seg.content);
      for (const g of gallerySegments) {
        if (g.type === "html" && g.content) {
          const withPullQuote = extractPullQuoteAndKeyTakeaways(g.content);
          const withProductBox = extractProductBoxSegments(withPullQuote);
          result.push(...(withProductBox as PostBodySegment[]));
        } else {
          result.push(g as PostBodySegment);
        }
      }
    } else if (seg.type === "html") {
      result.push(seg);
    }
  }
  return result;
}
