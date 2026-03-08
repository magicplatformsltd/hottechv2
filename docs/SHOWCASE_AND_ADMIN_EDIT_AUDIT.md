# Showcase Pages & Admin Edit 404 — Audit

**Date:** March 7, 2026  
**Context:** Showcase products block not loading on pages (e.g. `hot.tech/mwc-2026`), Edit Post and Edit Newsletter admin pages returning 404, and console error: *"You cannot use different slug names for the same dynamic path ('slug' !== 'vertical')."*

---

## Executive Summary

| Issue | Likely cause | Proposed fix |
|-------|--------------|--------------|
| **1. Showcase products not loading on public page** | Public `[vertical]/[[...slug]]` post view never renders `ShowcaseGrid`; only `PostBody(html)` is used. `showcase_data` exists on the post but is only rendered in admin preview. | Render `ShowcaseGrid` on the public post page when `content_type_slug` is showcase and `showcase_data` is present. |
| **2. Edit Post page 404** | Route collision and/or build-time "different slug names" error. `/admin/posts/[uuid]` can be matched by `(website)/[vertical]/[[...slug]]` (vertical=admin, slug=[posts, uuid]), which then runs the website resolver, fails to find a template/product/post for "admin", and calls `notFound()`. | Reserve "admin" (and api, etc.) so they are not treated as verticals; ensure admin routes take precedence or guard early in `[vertical]` and return 404/redirect so only admin route handles `/admin/*`. |
| **3. "different slug names" error** | Same URL can match both `(admin)/admin/posts/[id]` (param `id`) and `(website)/[vertical]/[[...slug]]` (params `vertical`, `slug`). Next.js may be complaining that the same path segment is represented by different param names in different route trees. | Resolve collision (see above); optionally align param naming or route structure so one clear route handles `/admin/*`. |
| **4. Edit Newsletter page 404** | Same route-collision pattern: `/admin/newsletters/[id]` can be matched by `[vertical]` with vertical=admin, slug=[newsletters, id]. | Same as #2 — reserve "admin" and ensure admin routes are the only handlers for `/admin/*`. |
| **5. Scheduler / products DB** | Unlikely direct cause. Cron publish and product DB are separate from routing. Edit Post and Edit Newsletter share the same URL shape (`/admin/:section/:id`), so they break together when `[vertical]` catches `/admin`. | No scheduler-specific change; fix routing. |

---

## High-Level Summary & To Do List

### Issue 1 — Showcase products not loading on public pages (e.g. `/mwc-2026`)

**Summary:** The page loads but the showcase products block is empty. The public post view only renders the article body (`PostBody`); it never renders `ShowcaseGrid`. Showcase data lives on the post and is only used in admin preview.

**Proposed fix:** In the public `[vertical]/[[...slug]]` page, when rendering a post, also render `ShowcaseGrid` when the post has showcase content type and `showcase_data` (mirror admin preview logic).

---

### Issue 2 — Edit Post page 404 (`/admin/posts/[id]`)

**Summary:** Navigating to Edit Post returns 404. The same URL can be matched by the website route `[vertical]/[[...slug]]` with `vertical=admin`, which then tries to resolve "admin" as a template/product/post, fails, and calls `notFound()`.

**Proposed fix:** Treat `admin` (and `api`, `login`) as reserved in the website route and call `notFound()` when `vertical` is reserved; ensure the admin route tree is the only one that handles `/admin/*` (static precedence or path prefix/middleware).

---

### Issue 3 — "Different slug names" error (`'slug' !== 'vertical'`)

**Summary:** Next.js reports conflicting param names for the same path: the admin tree uses static `admin` + `[id]`, the website tree uses `[vertical]` + `[[...slug]]` for the same URLs.

**Proposed fix:** Resolve the route collision so only one tree handles `/admin/*`; optionally put the public vertical route under a path prefix so `admin` is never a `vertical` value.

---

### Issue 4 — Edit Newsletter page 404 (`/admin/newsletters/[id]`)

**Summary:** Same as Edit Post: the website route can match `/admin/newsletters/[id]` as `vertical=admin`, `slug=[newsletters, id]`, then fail and 404.

**Proposed fix:** Same as Issue 2 — reserve `admin` and ensure only admin routes handle `/admin/*`. No separate newsletter fix needed.

---

### Issue 5 — Scheduler / products DB

**Summary:** Not the cause. Cron publish and the products backend don’t define routes; the 404s come from the `/admin` vs `[vertical]` collision.

**Proposed fix:** None for scheduler or products DB; fix routing only.

---

### To Do List

| # | Task | Owner / Notes | Status |
|---|------|----------------|--------|
| 1 | **Add reserved-segment guard** — In `app/(website)/[vertical]/[[...slug]]/page.tsx`, at the very start of the page component and of `generateMetadata`, if `vertical` is in `['admin', 'api', 'login']` (or your reserved list), call `notFound()`. | Prevents website resolver from running on `/admin/*`. | ✅ Done |
| 2 | **Render ShowcaseGrid on public post view** — In the same file, in both branches that render a post (fallback post and main `r.type === 'post'`), when `post.content_type_slug?.startsWith('showcase_')` and `Array.isArray(post.showcase_data) && post.showcase_data.length > 0`, render `<ShowcaseGrid type={...} items={post.showcase_data} displayOptions={post.display_options} />` (mirror `app/(admin)/admin/preview/[id]/page.tsx` ~lines 201–209). | Fixes empty showcase block on e.g. `/mwc-2026`. | ✅ Done |
| 3 | **Confirm post data includes showcase fields** — Ensure any loader used by the public vertical page (e.g. `getPostBySlug` in `lib/data.ts`) returns `showcase_data`, `display_options`, and `content_type_slug`. Audit already notes `getPostBySlug` does; double-check no other code path is used. | Required for ShowcaseGrid to have data. | ✅ Verified (no change needed) |
| 4 | **Verify admin route precedence** — Confirm that for paths like `/admin/posts/<uuid>`, Next.js uses `(admin)/admin/posts/[id]` and not `(website)/[vertical]/[[...slug]]`. If the website route still wins, add a path prefix for the website dynamic route (e.g. `/p/[vertical]/[[...slug]]`) or use middleware so only the admin app serves `/admin`. | Ensures Edit Post and Edit Newsletter load. | ⏳ Test after deploy |
| 5 | **Re-test after changes** — Verify: (a) `/mwc-2026` (or another showcase post) shows the products block; (b) `/admin/posts/<id>` loads the Edit Post page; (c) `/admin/newsletters/<id>` loads the Edit Newsletter page; (d) console no longer shows "different slug names" error. | Validation. | ⏳ Test after deploy |

---

## 1. Showcase Products Block Not Loading (e.g. `/mwc-2026`)

### Observed behaviour

- Page like `localhost:3000/mwc-2026` or `hot.tech/mwc-2026` loads (e.g. 200 from `/admin/posts?q=mwc+2026` in some flows), but the **showcase products block does not show any products**.

### Root cause

- **Public route:** `app/(website)/[vertical]/[[...slug]]/page.tsx`.
- For a URL like `/mwc-2026`, the page resolves to a **post** (e.g. via `resolveLevel2(vertical, vertical)` → `getPostBySlug("mwc-2026")`).
- When the resolved type is `"post"`, the page only renders:
  - Header (title, date)
  - Featured image
  - **`PostBody`** with the post’s HTML content (from `content` / `body`).
- **`PostBody`** → `parsePostBody(html)` → **`BlockRenderer`**.  
  `BlockRenderer` supports: `sponsor`, `imageGallery`, `imageComparison`, `pullQuote`, `keyTakeaways`, `productBox`. It does **not** support a “showcase” block type that reads `showcase_data` from the post.
- **Showcase data** lives on the **post** as `post.showcase_data` and `post.content_type_slug` (e.g. `showcase_products`, `showcase_people`). It is only rendered in:
  - **Admin preview:** `app/(admin)/admin/preview/[id]/page.tsx` uses `ShowcaseGrid` when `post.content_type_slug?.startsWith("showcase_")` and `post.showcase_data` is present.

So: on the **public** post page, the showcase products block is **never** rendered; only the HTML body is. Products are not “failing to load” — they are never asked to render.

### Relationship to `/products` and middleware

- The **products backend** (`/admin/products`, product database, reviews) does not by itself prevent showcase products from loading; the issue is the missing `ShowcaseGrid` on the public post view.
- **Middleware** (`middleware.ts`) skips `/admin` and does not affect `/mwc-2026`. No change needed there for this bug.

### Proposed fix (showcase products on public page)

1. **In `app/(website)/[vertical]/[[...slug]]/page.tsx`**, in the branch where you render a **post** (both the “fallback” post branch and the main “r.type === 'post'” branch):
   - After or before the main article content, when:
     - `post.content_type_slug` is `showcase_products` or `showcase_people`, and  
     - `Array.isArray(post.showcase_data) && post.showcase_data.length > 0`
   - Render **`ShowcaseGrid`** with:
     - `type={ post.content_type_slug === "showcase_people" ? "people" : "products" }`
     - `items={post.showcase_data}`
     - `displayOptions={post.display_options}` (or equivalent).
2. Reuse the same logic and shape as in `app/(admin)/admin/preview/[id]/page.tsx` (lines ~201–209) so behaviour is consistent between preview and live.
3. Ensure **`getPostBySlug`** (and any other data path that fetches the post for this page) returns `showcase_data`, `display_options`, and `content_type_slug`.  
   - In `lib/data.ts`, `getPostBySlug` already selects and returns these; confirm the same is true for any other loader used by this page.

---

## 2. Edit Post Page 404 (`/admin/posts/[id]`)

### Observed behaviour

- **GET** `/admin/posts/94207ce4-b36f-4d88-91f0-5be77a57c55a` (and similar) returns **404**.
- Console shows: *"You cannot use different slug names for the same dynamic path ('slug' !== 'vertical')."*
- Edit **Product** (`/admin/products/[id]`) works; Edit **Post** and Edit **Newsletter** do not.

### Root cause (route collision)

- Two route trees can match **`/admin/posts/<uuid>`**:
  1. **Admin:** `app/(admin)/admin/posts/[id]/page.tsx`  
     - Path: `admin` (static), `posts` (static), `[id]` (dynamic).  
     - Params: `{ id: "<uuid>" }`.
  2. **Website:** `app/(website)/[vertical]/[[...slug]]/page.tsx`  
     - Path: `[vertical]` (dynamic), `[[...slug]]` (optional catch-all).  
     - For `/admin/posts/<uuid>`: `vertical = "admin"`, `slug = ["posts", "<uuid>"]`.

- If the **website** route is chosen for this URL:
  - The page runs with `vertical = "admin"` and `slug = ["posts", "<uuid>"]`.
  - It runs `resolveLevel1("admin")` → `getTemplateBySlug("admin")` → typically `null`.
  - Then `resolveLevel2("admin", "admin")` → no product/post with slug `"admin"` → `null`.
  - The code then hits `notFound()` → **404**.

So the Edit Post page 404 can be explained by the **website** handler incorrectly handling `/admin/...` and returning 404. The “different slug names” error is consistent with the same path being associated with different param names (`id` vs `vertical`/`slug`) in different route definitions.

### Why Edit Product might still work

- If you usually open Edit Product via a different navigation or base URL, or if there is a different matcher (e.g. more specific segment), that route might be the one that wins. Once the collision exists, behaviour can differ by path and by how Next.js orders static vs dynamic segments. The fix is to make `/admin/*` exclusively handled by the admin tree.

### Proposed fix (Edit Post 404 and route collision)

1. **Reserve “admin” (and other prefixes) in the website route**  
   At the very start of the page component (and of `generateMetadata`) in `app/(website)/[vertical]/[[...slug]]/page.tsx`:
   - If `vertical` is one of `admin`, `api`, `login`, or any other reserved first segment that should never be a “vertical”, then:
     - Call **`notFound()`** (or redirect to the same URL if you want Next to re-run routing).
   - This does not fix which route is *chosen* by the framework, but it avoids running the full website resolver for `/admin/...` and may reduce confusion. The real fix is (2).

2. **Ensure only the admin tree matches `/admin/*`**  
   - Confirm in Next.js that **static segments win** over dynamic: `(admin)/admin/...` should take precedence over `(website)/[vertical]/...` for paths starting with `admin`. If in your version/build the website route still wins, consider:
     - Moving the catch-all website route under a path prefix (e.g. `/p/[vertical]/[[...slug]]`) so that `/admin` is never matched by it, or
     - Using middleware to rewrite `/admin` to an internal path that only the admin app serves.
   - Ensure there are no **duplicate or conflicting** dynamic segments for the same path (e.g. no other `[slug]` vs `[vertical]` at the same level); that would address the “different slug names” error at the source.

3. **Data path**  
   - The Edit Post page itself (`app/(admin)/admin/posts/[id]/page.tsx`) and `getPostById(id)` are correct. The 404 is from routing, not from `getPostById` returning null (unless the wrong page runs and never calls it).

---

## 3. “You cannot use different slug names for the same dynamic path ('slug' !== 'vertical')”

### Interpretation

- Next.js is reporting that the **same** logical path (or segment position) is defined with **different dynamic param names** in different routes.
- Here, the **first** segment of paths like `/admin/posts/<id>` can be:
  - In **admin:** a static segment `admin` (no param name).
  - In **website:** the dynamic segment **`[vertical]`** (param name `vertical`).
- The **later** segment (the uuid) can be:
  - In **admin:** **`[id]`** (param name `id`).
  - In **website:** part of **`[[...slug]]`** (param name `slug`).

So the same path is described in two ways; the framework may be strict about param names when multiple routes could match.

### Proposed fix

- Same as §2: ensure **only one** route tree is responsible for `/admin/*` (the admin tree), and that the website tree does not use the same path shape for different param names.
- Optionally, avoid having a single top-level dynamic segment like `[vertical]` that can also match `admin`; e.g. put the public vertical under a prefix so that `admin` is never a value of `vertical`.

---

## 4. Edit Newsletter Page 404 (`/admin/newsletters/[id]`)

### Root cause

- Same collision as Edit Post: `/admin/newsletters/<id>` can be matched by:
  - **Admin:** `app/(admin)/admin/newsletters/[id]/page.tsx` (params `{ id }`).
  - **Website:** `[vertical]` = `"admin"`, `slug` = `["newsletters", "<id>"]` → resolver fails → `notFound()` → 404.

### Proposed fix

- Same as §2: reserve `admin` and ensure only the admin routes handle `/admin/*`. No newsletter-specific change needed; fixing the route collision fixes both Edit Post and Edit Newsletter.

---

## 5. Scheduler / Products DB

### Scheduler (cron publish)

- **Location:** `app/api/cron/publish/route.ts`.  
  It finds posts and products with `status = 'published'` and `published_at` in a time window and revalidates paths. It does **not** define or alter routes.
- **Conclusion:** Scheduler is unrelated to the Edit Post / Edit Newsletter 404 or the “different slug names” error.

### Products backend

- **Location:** `app/(admin)/admin/products/` (list, `[id]`, templates, awards, etc.).  
  This is a separate admin section; it does not change how `[vertical]` or `[slug]` are defined.
- **Conclusion:** The products backend does not by itself break the Edit Post or Edit Newsletter pages; the breakage is from the shared `/admin/...` route collision with `(website)/[vertical]/[[...slug]]`.

---

## 6. Summary of Recommended Changes

| # | Change | Where |
|---|--------|--------|
| 1 | Render **ShowcaseGrid** for showcase posts on the public page when `content_type_slug` is showcase and `showcase_data` exists. | `app/(website)/[vertical]/[[...slug]]/page.tsx` (post branches) |
| 2 | At the top of the `[vertical]` page and of `generateMetadata`, if `vertical` is in `['admin','api','login',...]`, call **notFound()**. | Same file |
| 3 | Verify **static route precedence** so `(admin)/admin/...` is used for all `/admin/*` paths; if not, add a path prefix for the website dynamic route or use middleware so only admin handles `/admin`. | Route structure / middleware |
| 4 | Ensure **no duplicate dynamic segment names** for the same path across the app (so “different slug names” disappears). | Same as #2–#3 |

---

## 7. Files to Touch (checklist)

- **`app/(website)/[vertical]/[[...slug]]/page.tsx`**  
  - Add reserved-segment guard (`vertical === 'admin'` → `notFound()`).  
  - In both post-rendering branches, add `ShowcaseGrid` when `post.content_type_slug?.startsWith("showcase_")` and `post.showcase_data` is present (mirror `app/(admin)/admin/preview/[id]/page.tsx`).
- **Route structure**  
  - Confirm `(admin)/admin/...` wins for `/admin/*`; if not, consider prefixing the website dynamic route or middleware.
- **Data layer**  
  - Confirm all post-fetch paths used by the public vertical page return `showcase_data`, `display_options`, and `content_type_slug` (already the case in `lib/data.ts` for `getPostBySlug`).

This audit is intended for an AI architect or engineer to implement the fixes and validate behaviour on showcase pages (e.g. `mwc-2026`), Edit Post, and Edit Newsletter.
