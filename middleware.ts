import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PERMANENT = 301;

/** Paths that must never be redirected (internal, admin, api, static). */
function shouldSkip(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p.startsWith("/_next")) return true;
  if (p.startsWith("/admin")) return true;
  if (p.startsWith("/api")) return true;
  if (p.startsWith("/favicon")) return true;
  if (p.startsWith("/static")) return true;
  if (/\.[a-z0-9]+$/i.test(p)) return true; // static assets with extension
  return false;
}

/**
 * Global redirect middleware: legacy URL cleanup and review normalization.
 * - Category cleanup: /categories/consumer-tech/phones → /phones
 * - Shortened categories: /categories/news → /news
 * - Review normalization: /[slug]-review → /[slug]/review
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (shouldSkip(pathname)) return NextResponse.next();

  const segments = pathname.split("/").filter(Boolean);

  // 1) Category cleanup: /categories/consumer-tech/phones → /phones (root vertical = last segment)
  if (segments[0] === "categories" && segments.length >= 2) {
    const last = segments[segments.length - 1];
    const target = `/${last}`;
    return NextResponse.redirect(new URL(target, request.url), PERMANENT);
  }

  // 2) Shortened categories: /categories/news → /news (strip /categories/ entirely)
  if (segments[0] === "categories" && segments.length === 1) {
    return NextResponse.next(); // /categories only - could redirect to / or leave; spec says "any other paths"
  }
  // (Above: length >= 2 already handled. So /categories/anything → already redirected to /last. So /categories/news → /news with first rule.)

  // 3) Review normalization: /[slug]-review or /[slug]-review/ → /[slug]/review
  const singleSegment = segments.length === 1 && segments[0];
  if (singleSegment && singleSegment.endsWith("-review")) {
    const slug = singleSegment.slice(0, -"-review".length);
    if (slug) {
      const target = `/${slug}/review`;
      return NextResponse.redirect(new URL(target, request.url), PERMANENT);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/|api/|admin/|favicon|static/).*)",
  ],
};
