/**
 * Fetches a URL as clean Markdown via Jina Reader (r.jina.ai).
 * On 451/403, falls back to direct fetch with browser-like headers and returns stripped HTML.
 */

const JINA_READER_BASE = "https://r.jina.ai/";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

export type FetchMarkdownResult =
  | { markdown: string; isHtml?: boolean; statusCode?: undefined }
  | { markdown: null; statusCode?: number; isHtml?: boolean };

/** Strip <script> and <style> tags from HTML to reduce noise for LLM. */
function stripScriptAndStyle(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "\n")
    .trim();
}

/**
 * Fetch the content of a URL as Markdown using Jina Reader.
 * If Jina returns 451 or 403, falls back to fetching the URL directly with browser-like headers
 * and returns the HTML with <script> and <style> removed.
 * @param url - Full URL (e.g. https://www.gsmarena.com/samsung_galaxy_s24-12345.php)
 * @returns Result with markdown (or stripped HTML when fallback used), optional isHtml, or null + statusCode
 */
export async function fetchUrlAsMarkdown(url: string): Promise<FetchMarkdownResult> {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return { markdown: null };

  let targetUrl: string;
  try {
    targetUrl = new URL(trimmed).toString();
  } catch {
    console.error("[fetchUrlAsMarkdown] Invalid URL:", trimmed);
    return { markdown: null };
  }

  const encodedTarget = encodeURIComponent(targetUrl);
  const readerUrl = `${JINA_READER_BASE}${encodedTarget}`;
  console.log("Fetching from Jina:", readerUrl);

  const jinaHeaders = {
    ...BROWSER_HEADERS,
    Accept: "text/markdown",
    "X-Return-Format": "markdown",
  };

  try {
    const res = await fetch(readerUrl, {
      method: "GET",
      headers: jinaHeaders,
      signal: AbortSignal.timeout(30_000),
    });

    if (res.ok) {
      const text = await res.text();
      const markdown = text?.trim() || null;
      return markdown ? { markdown } : { markdown: null };
    }

    if (res.status === 451 || res.status === 403) {
      console.warn("[fetchUrlAsMarkdown] Jina returned", res.status, "- trying direct fetch:", targetUrl);
      try {
        const directRes = await fetch(targetUrl, {
          method: "GET",
          headers: { ...BROWSER_HEADERS, Accept: "text/html" },
          signal: AbortSignal.timeout(30_000),
        });
        if (!directRes.ok) {
          return { markdown: null, statusCode: res.status };
        }
        const html = await directRes.text();
        const stripped = stripScriptAndStyle(html || "");
        return stripped ? { markdown: stripped, isHtml: true } : { markdown: null, statusCode: res.status };
      } catch (fallbackErr) {
        console.error("[fetchUrlAsMarkdown] Direct fetch failed:", fallbackErr);
        return { markdown: null, statusCode: res.status };
      }
    }

    console.error("[fetchUrlAsMarkdown]", res.status, res.statusText, targetUrl);
    return { markdown: null, statusCode: res.status };
  } catch (err) {
    console.error("[fetchUrlAsMarkdown]", err);
    return { markdown: null };
  }
}
