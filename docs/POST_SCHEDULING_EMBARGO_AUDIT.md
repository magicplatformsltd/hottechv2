# Post Scheduling & Date Picker Audit

**Date:** February 27, 2025  
**Context:** Standardizing CMS dates to America/New_York and ensuring "Scheduled/Embargoed" posts work correctly.

---

## Executive Summary

| Area | Status | Details |
|------|--------|---------|
| **Date Picker** | ✓ OK | Always editable; not disabled when published |
| **Date Saving (New Posts)** | ✓ OK | `createPost` respects the Date Picker value |
| **Date Saving (Edits)** | ⚠ Bug | `updatePost` ignores `published_at`; date changes are never persisted |
| **Publish Action** | ⚠ Bug | `publishPost` never receives form data; uses DB value only |
| **Embargo Leak** | 🔴 Critical | No query filters out `published_at > now()`; future-dated posts appear on homepage |

---

## Task 1: The Date Picker & Editing

**Location:** `app/(admin)/admin/posts/edit-post-form.tsx` (lines 364–371)

### Current Behavior

- The "Publish Date" picker is a `<input type="datetime-local">` in the sidebar under "Publish Date"
- **Not disabled when `status === 'published'`** — the date picker is always editable
- The value is stored in state as `publishedAt` and included in the form via `formData.set("published_at", publishedAt)` in `buildPostFormData()`
- Uses `toDatetimeLocal()` to convert UTC ISO to local `datetime-local` format for display

### Relevant Code

```tsx
<SidebarSection title="Publish Date" defaultOpen={true}>
  <input
    type="datetime-local"
    value={publishedAt}
    onChange={(e) => setPublishedAt(e.target.value)}
    className="..."
  />
</SidebarSection>
```

### Finding

The date picker is always editable regardless of publish status. It appears the intent is to allow updating the date even after publication, but (see Task 2) those updates are not persisted.

---

## Task 2: The Publish Action

**Location:** `app/(admin)/admin/posts/actions.ts`

### How `published_at` Is Handled

#### `createPost` (new posts) ✓

- Reads `published_at` from `FormData` and uses it when inserting
- Fallback: `published_at ? new Date(published_at).toISOString() : now`
- **The Date Picker value is respected for new posts**

#### `updatePost` (editing) ✗

- Payload includes only: `updated_at`, `draft_title`, `draft_summary`, `draft_content`, `draft_hero_image`
- **Does not read or persist `published_at`** — the Date Picker value is ignored entirely

#### `publishPost` (draft → published) ✗

- Does not receive form data
- Uses existing `post.published_at` from the database, or `new Date().toISOString()` if null
- **Never uses the Date Picker value from the form**

### Flow Summary

| Scenario | Result |
|----------|--------|
| New post, set future date, click Publish | ✓ Date is saved |
| Draft post, change date, click Publish | ✗ Date change ignored; uses existing DB value or `now()` |
| Published post, change date, click Publish | ✗ Date change ignored; uses existing DB value |

---

## Task 3: The Embargo Leak (Critical)

**Location:** `lib/data.ts`, `app/actions/posts.ts`, `lib/actions/post-picker.ts`

### Question

> If I set a post to `published` but give it a date of tomorrow, will it accidentally show up on the homepage right now?

**Answer: Yes.** The frontend queries do **not** filter out posts where `published_at > now()`.

### Queries Audited

| Query | File | Filter | Embargo Protection |
|-------|------|--------|--------------------|
| `getSupabasePosts` | `lib/data.ts` | `status = 'published'` | None |
| `getUnifiedFeed` | `lib/data.ts` | via `getSupabasePosts` | None |
| `getSmartFeedPosts` | `lib/data.ts` | `status = 'published'` | None |
| `getPostsByTaxonomy` | `lib/data.ts` | `status = 'published'` | None |
| `getPostsByIds` | `lib/data.ts` | `status = 'published'` | None |
| `getMorePosts` | `app/actions/posts.ts` | `status = 'published'` | None |
| `getPostSlugsForSitemap` | `lib/data.ts` | `status = 'published'` | None |
| `searchPosts` (post picker) | `lib/actions/post-picker.ts` | `status = 'published'` | None |

**None** of these add `.lte("published_at", new Date().toISOString())` or equivalent.

### Impact

A post with `status = 'published'` and `published_at` set to tomorrow will appear on:

- Homepage (unified feed, feature grids, smart feeds)
- Category, tag, and content-type archive pages
- `/all` archive
- Sitemap
- Direct URL `/{slug}` (article page does not enforce embargo)

---

## Recommendations

### 1. Add Embargo Filter to All Public Queries (Critical)

Add a filter to exclude future-dated posts wherever published posts are fetched for public display:

```ts
.lte("published_at", new Date().toISOString())
```

Apply to: `getSupabasePosts`, `getSmartFeedPosts`, `getPostsByTaxonomy`, `getPostsByIds`, `getMorePosts`, `getPostSlugsForSitemap`, `searchPosts` (post picker).

### 2. Persist `published_at` When Editing (Bug Fix)

- Either include `published_at` in `updatePost`'s payload (reading from formData), or
- Pass `published_at` into `publishPost` so it can set/override the date when publishing

### 3. Article Page Embargo (Optional)

If direct article access by URL should also respect embargo, add logic in `app/(website)/[slug]/page.tsx` to `notFound()` when `post.status === 'published'` and `post.published_at > now`.

### 4. America/New_York Standardization

When implementing timezone standardization, ensure:

- Server stores UTC (or TZ-aware timestamps)
- `datetime-local` inputs and display handle America/New_York consistently
- All embargo comparisons use the same reference (e.g., server `now()` in UTC or explicit NY time)

---

*Generated from codebase audit — February 2025*
