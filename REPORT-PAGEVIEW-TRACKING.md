# Report: How Settings > Reporting Works for Pageview Tracking

**Date:** February 27, 2025  
**Scope:** Admin Reporting pageview tracking flow

---

## Overview

In the Hot Tech admin, **Reporting** is a standalone section (alongside Settings, not nested under it) at `/admin/reporting`. It displays platform performance, including **pageview analytics** for posts and the homepage, plus newsletter opens and subscriber growth.

---

## Architecture Summary

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   ViewTracker       │────▶│  /api/analytics/track │────▶│  post_analytics     │
│   (client-side)     │     │  (server API route)   │     │  (Supabase table)   │
└─────────────────────┘     └──────────────────────┘     └──────────┬──────────┘
                                                                   │
                                                                   ▼
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Reporting Page    │◀────│  lib/analytics.ts     │◀────│  getTopPosts()      │
│   /admin/reporting  │     │  getTopPosts()        │     │  queries post_analytics
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
```

---

## 1. Data Collection: ViewTracker Component

**Location:** `hot-tech-v2/components/analytics/ViewTracker.tsx`

### Purpose
Tracks pageviews for public visitors (non-authenticated users) on:

- **Homepage** — via `customPath="/"`
- **Post pages** — via `slug={post.slug}`

### Behavior

| Feature | Implementation |
|--------|-----------------|
| **Visitor ID** | Stored in `localStorage` under `visitor_id`. Created with `crypto.randomUUID()` if missing. |
| **Debouncing** | 30-minute window per page/slug. Uses `sessionStorage` keys (`viewed_post_{slug}` or `viewed_page_{path}`) to avoid duplicate counts. |
| **Auth exclusion** | Authenticated users (logged-in) are **not** tracked. |
| **Payload** | `visitorId`, `referrer`, `userAgent`, plus either `slug` (posts) or `path` (custom paths like `/`). |

### Where It's Used

| Page | Usage |
|------|-------|
| `app/page.tsx` (Homepage) | `<ViewTracker customPath="/" />` |
| `app/(website)/[slug]/page.tsx` (Post) | `<ViewTracker slug={post.slug ?? undefined} />` |

### Flow (Client-Side)
1. `useEffect` runs when component mounts.
2. Checks session debounce; skips if same page viewed within 30 minutes.
3. Skips if user is authenticated.
4. Gets or creates `visitorId` from `localStorage`.
5. Sends `POST` to `/api/analytics/track` with JSON payload.
6. On success, sets `sessionStorage` timestamp to enforce debounce.

---

## 2. API Layer: Track Endpoint

**Location:** `hot-tech-v2/app/api/analytics/track/route.ts`

### Request
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:** `{ visitorId, referrer?, userAgent?, slug?, path? }`

### Validation
- Requires `visitorId` and either `slug` or `path`.
- Returns `{ ok: true }` with status 200 in all cases (including validation failures) to avoid exposing errors.

### Processing
1. For `slug`: looks up `post_id` from `posts` table.
2. Inserts a row into `post_analytics` with:
   - `visitor_id`
   - `post_id` (null for homepage/path-only views)
   - `path` (e.g. `"/"` for homepage)
   - `referrer`
   - `user_agent`

### Security
- RLS allows anonymous inserts via `Allow insert for anon (track API)`.
- No public reads; only authenticated admins can query analytics.

---

## 3. Database: post_analytics Table

**Schema (from migrations):**

```sql
CREATE TABLE public.post_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,  -- nullable
  path TEXT,                                                   -- e.g. '/' for homepage
  visitor_id TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes
- `idx_post_analytics_post_id`
- `idx_post_analytics_visitor_id`

### Row Semantics
- **Post views:** `post_id` set, `path` usually null (or can coexist).
- **Homepage views:** `post_id` null, `path` = `'/'`.
- Other custom paths could use `path` only with `post_id` null.

---

## 4. Reporting Page: Data Consumption

**Location:** `hot-tech-v2/app/(admin)/admin/reporting/page.tsx`

### Access
- Route: `/admin/reporting`
- Time ranges: 7, 30, or 90 days (via `?days=N`).

### Data Sources

| Data | Source | Used For |
|------|--------|----------|
| **Chart** | `getChartData(days)` | New Subscribers + Newsletter Opens (from `subscribers`, `newsletter_events`) |
| **Content table** | `getTopPosts()` | **Pageviews** from `post_analytics` |
| **Content table** | `getTopNewsletters()` | Newsletter opens from `newsletter_events` |

**Note:** The line chart shows subscribers and newsletter opens only; it does **not** show pageviews. Pageviews appear only in the **Content Breakdown** table under the "Posts" tab.

---

## 5. Pageview Aggregation: getTopPosts()

**Location:** `hot-tech-v2/lib/analytics.ts`

### Logic
1. Selects all rows from `post_analytics` with `post_id`, `visitor_id`, `path`, and joined `posts(title, slug)`.
2. Groups by content key:
   - **Homepage:** `path === '/'` or `post_id == null` → key `"homepage"`
   - **Posts:** keyed by `post_id`
3. For each group:
   - Counts total views.
   - Counts unique visitors (via `Set` of `visitor_id`).
4. Sorts by total views descending.
5. Returns top 20 items.

### Output Shape
```ts
{ post_id, title, slug, total_views, unique_visitors }[]
```

---

## 6. UI: Content Breakdown

**Location:** `hot-tech-v2/app/(admin)/admin/reporting/ContentBreakdown.tsx`

### "Posts" Tab (Pageviews)
- Columns: **Title**, **Unique Visitors**, **Total Views**
- Links to post pages (via slug) or admin edit URL when no slug.
- Homepage row shows "Homepage" with slug `/`.

### "Newsletters" Tab
- Newsletter opens only (from `newsletter_events`), not pageviews.

---

## Summary: Pageview Tracking Flow

1. **Track:** `ViewTracker` fires on homepage and post pages for anonymous visitors.
2. **Debounce:** 30 minutes per page per visitor via `sessionStorage`.
3. **Send:** `POST` to `/api/analytics/track` with `visitorId`, `slug` or `path`, `referrer`, `userAgent`.
4. **Store:** `post_analytics` row with `visitor_id`, `post_id` (or null), `path`, etc.
5. **Report:** `getTopPosts()` aggregates views and unique visitors.
6. **Display:** Reporting → Content Breakdown → Posts tab shows top 20 by views.

---

## Notable Gaps / Observations

- **No on/off toggle:** Pageview tracking is always on for public pages; no setting in Admin Settings.
- **Chart excludes pageviews:** The Performance Chart shows only subscribers and newsletter opens.
- **Limited path tracking:** Only homepage (`/`) and post slugs are instrumented; no generic route tracking.
- **No date filter on pageviews:** `getTopPosts()` returns all-time data; the `?days=` filter applies only to the chart (subscribers/opens).
