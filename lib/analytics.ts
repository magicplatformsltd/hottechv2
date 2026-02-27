"use server";

import { createClient } from "@/utils/supabase/server";
import { format, eachDayOfInterval, startOfDay, endOfDay, parseISO } from "date-fns";

export type ChartDataPoint = {
  date: string;
  newSubscribers: number;
  newsletterOpens: number;
  pageviews: number;
  newPosts: number;
};

export type TopPostRow = {
  post_id: string;
  title: string;
  slug: string | null;
  total_views: number;
  unique_visitors: number;
};

export type TopNewsletterRow = {
  newsletter_id: string;
  subject: string;
  sent_at: string | null;
  total_opens: number;
  unique_opens: number;
};

/**
 * Chart data: new subscribers, newsletter opens, pageviews, and new posts per day
 * within the provided date range.
 */
export async function getChartData(
  startDate: Date,
  endDate: Date
): Promise<ChartDataPoint[]> {
  const start = startOfDay(startDate);
  const end = endOfDay(endDate);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const supabase = await createClient();

  const [subsRes, opensRes, pageviewsRes, postsRes] = await Promise.all([
    supabase
      .from("subscribers")
      .select("created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("newsletter_events")
      .select("created_at")
      .eq("type", "OPEN")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("post_analytics")
      .select("created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("posts")
      .select("published_at")
      .eq("status", "published")
      .gte("published_at", startIso)
      .lte("published_at", endIso),
  ]);

  const subsByDay: Record<string, number> = {};
  const opensByDay: Record<string, number> = {};
  const pageviewsByDay: Record<string, number> = {};
  const newPostsByDay: Record<string, number> = {};

  const dayKeys = eachDayOfInterval({ start, end }).map((d) => {
    const k = format(d, "yyyy-MM-dd");
    subsByDay[k] = 0;
    opensByDay[k] = 0;
    pageviewsByDay[k] = 0;
    newPostsByDay[k] = 0;
    return k;
  });

  /** Bucket ISO timestamp into local-date key (yyyy-MM-dd). Parses as Date and formats
   *  in local timezone so days don't shift from UTC bleed-through. */
  function toLocalDateKey(iso: string): string {
    const d = parseISO(iso);
    return format(d, "yyyy-MM-dd");
  }

  /** Format a date key (yyyy-MM-dd) to display string (MMM d) without timezone shift.
   *  Parse as local date parts so "2025-02-27" always shows "Feb 27" regardless of server TZ. */
  function formatDateKey(k: string): string {
    const [y, m, day] = k.split("-").map(Number);
    return format(new Date(y!, m! - 1, day!), "MMM d");
  }

  for (const row of subsRes.data ?? []) {
    const at = (row as { created_at?: string }).created_at;
    if (at) {
      const k = toLocalDateKey(at);
      if (k in subsByDay) subsByDay[k] += 1;
    }
  }
  for (const row of opensRes.data ?? []) {
    const at = (row as { created_at?: string }).created_at;
    if (at) {
      const k = toLocalDateKey(at);
      if (k in opensByDay) opensByDay[k] += 1;
    }
  }
  for (const row of pageviewsRes.data ?? []) {
    const at = (row as { created_at?: string }).created_at;
    if (at) {
      const k = toLocalDateKey(at);
      if (k in pageviewsByDay) pageviewsByDay[k] += 1;
    }
  }
  for (const row of postsRes.data ?? []) {
    const at = (row as { published_at?: string }).published_at;
    if (at) {
      const k = toLocalDateKey(at);
      if (k in newPostsByDay) newPostsByDay[k] += 1;
    }
  }

  return dayKeys.map((k) => ({
    date: formatDateKey(k),
    newSubscribers: subsByDay[k] ?? 0,
    newsletterOpens: opensByDay[k] ?? 0,
    pageviews: pageviewsByDay[k] ?? 0,
    newPosts: newPostsByDay[k] ?? 0,
  }));
}

type ContentAgg = {
  total: number;
  visitors: Set<string>;
  title: string;
  slug: string | null;
};

/**
 * Top 20 content items by total views (post_analytics: posts + homepage)
 * within the provided date range.
 * Homepage: rows with path === '/' or !post_id, keyed as 'homepage'.
 * Posts: keyed by post_id, title/slug from joined posts.
 */
export async function getTopPosts(
  startDate: Date,
  endDate: Date
): Promise<TopPostRow[]> {
  const supabase = await createClient();
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  const { data: rows, error } = await supabase
    .from("post_analytics")
    .select("post_id, visitor_id, path, posts(title, slug)")
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  if (error) {
    console.error("[getTopPosts]", error);
    return [];
  }

  const byKey: Record<string, ContentAgg> = {};

  for (const r of rows ?? []) {
    // Force cast to any to handle Supabase returning arrays for joined relations
    const row = r as any;
    const vid = row.visitor_id;
    const path = row.path;
    const pid = row.post_id;
    // Handle case where posts might be an array (Supabase default) or object
    const postsData = row.posts;
    const postTitle = Array.isArray(postsData) ? postsData[0]?.title : postsData?.title;
    const postSlug = Array.isArray(postsData) ? postsData[0]?.slug : postsData?.slug;

    const key = path === "/" || pid == null ? "homepage" : pid;
    if (!byKey[key]) {
      byKey[key] = {
        total: 0,
        visitors: new Set(),
        title: key === "homepage" ? "Homepage" : (postTitle ?? "—") || "—",
        slug: key === "homepage" ? "/" : (postSlug ?? null),
      };
    }
    byKey[key].total += 1;
    byKey[key].visitors.add(vid);
    if (key !== "homepage" && (postTitle != null || postSlug != null) && (byKey[key].title === "—" || !byKey[key].title)) {
      byKey[key].title = postTitle ?? "—";
      byKey[key].slug = postSlug ?? null;
    }
  }

  const sorted = Object.entries(byKey)
    .map(([post_id, agg]) => ({
      post_id,
      title: agg.title,
      slug: agg.slug,
      total_views: agg.total,
      unique_visitors: agg.visitors.size,
    }))
    .sort((a, b) => b.total_views - a.total_views)
    .slice(0, 20);

  return sorted;
}

/**
 * Top 20 sent newsletters by total opens (newsletters + newsletter_events)
 * within the provided date range.
 */
export async function getTopNewsletters(
  startDate: Date,
  endDate: Date
): Promise<TopNewsletterRow[]> {
  const supabase = await createClient();
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  const { data: rows, error } = await supabase
    .from("newsletter_events")
    .select("newsletter_id, recipient_id")
    .eq("type", "OPEN")
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  if (error) {
    console.error("[getTopNewsletters]", error);
    return [];
  }

  const byNewsletter: Record<
    string,
    { total: number; recipients: Set<string> }
  > = {};
  for (const r of rows ?? []) {
    const nid = (r as { newsletter_id: string; recipient_id: string | null })
      .newsletter_id;
    const rid = (r as { newsletter_id: string; recipient_id: string | null })
      .recipient_id ?? "";
    if (!byNewsletter[nid]) byNewsletter[nid] = { total: 0, recipients: new Set() };
    byNewsletter[nid].total += 1;
    byNewsletter[nid].recipients.add(rid);
  }

  const sorted = Object.entries(byNewsletter)
    .map(([newsletter_id, agg]) => ({
      newsletter_id,
      total_opens: agg.total,
      unique_opens: agg.recipients.size,
    }))
    .sort((a, b) => b.total_opens - a.total_opens)
    .slice(0, 20);

  if (sorted.length === 0) return [];

  const { data: newsletters } = await supabase
    .from("newsletters")
    .select("id, subject, sent_at")
    .in("id", sorted.map((s) => s.newsletter_id));

  const nlMap = new Map(
    (newsletters ?? []).map((n) => [
      (n as { id: string }).id,
      n as { id: string; subject: string | null; sent_at: string | null },
    ])
  );

  return sorted.map((s) => {
    const n = nlMap.get(s.newsletter_id);
    return {
      newsletter_id: s.newsletter_id,
      subject: n?.subject ?? "—",
      sent_at: n?.sent_at ?? null,
      total_opens: s.total_opens,
      unique_opens: s.unique_opens,
    };
  });
}
