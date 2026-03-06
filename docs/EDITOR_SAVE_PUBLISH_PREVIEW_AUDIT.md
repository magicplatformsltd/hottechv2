# Audit: Editor State, Save vs. Publish, and Preview Mechanisms

**Date:** March 6, 2025  
**Context:** Data loss when saving custom blocks (Products and People) via "Save Draft" in the post editor.

---

## Executive Summary

**Root cause of data loss:** The `updatePost` server action does **not** persist `showcase_data` or `display_options` (and several other fields). The form correctly includes them in the payload, but the server action ignores them. As a result, Products and People blocks are lost when "Save Draft" is clicked on existing posts.

---

## 1. State Management & Payload Construction

### Form State Management

- **Posts:** Standard React `useState` in `EditPostForm` (`edit-post-form.tsx`). No React Hook Form.
- **Newsletters:** Same pattern in `NewsletterForm` and `EditNewsletterForm`.

### Custom Blocks Integration

| Block | Location | State | Included in Payload? |
|-------|----------|-------|----------------------|
| **Products / People** | `ShowcaseManager` | `showcaseData` + `displayOptions` | ✅ Yes (lines 259–260) |
| **Sponsor Block** | TipTap node in `RichTextEditor` | Embedded in body HTML | ✅ Yes (via `body`) |

### Payload Construction (`buildPostFormData`)

The form correctly includes:

- `title`, `slug`, `excerpt`, `body`, `featured_image`, `published_at`
- `source_name`, `original_url`, `meta_title`, `meta_description`, `canonical_url`
- `category_ids`, `tag_ids`, `content_type_id`
- **`showcase_data`** (JSON string)
- **`display_options`** (JSON string)

### What Is Omitted from the Save Draft Payload?

**Nothing is omitted in the form.** The form sends all fields. The bug is on the **server**: `updatePost` does not read or persist several of these fields.

---

## 2. Database Schema (Save vs. Publish)

### Posts Table Structure

| Column | Purpose | Draft vs. Published |
|--------|---------|---------------------|
| `title`, `excerpt`, `content`, `main_image` | Published content | Used when `status = 'published'` |
| `draft_title`, `draft_summary`, `draft_content`, `draft_hero_image` | Draft content | Used for drafts and preview |
| `showcase_data` | Products/People JSON | Single column (no draft variant) |
| `display_options` | Options (hide_header, sponsor_block, etc.) | Single column (no draft variant) |
| `source_name`, `original_url`, `meta_title`, `meta_description`, `canonical_url` | SEO/source | Single columns |

### How Products and People Are Stored

- Stored in the `showcase_data` JSONB column as an array of `ShowcaseItem` objects.
- Content type (`showcase_products` vs. `showcase_people`) is determined by `post_content_types` → `content_types.slug`.
- `display_options` holds showcase-specific settings (e.g. `grid_columns`, `image_shape`, `hide_showcase_title`).

### Critical Bug: `updatePost` Ignores Many Fields

The `updatePost` action only updates:

- `draft_title`, `draft_summary`, `draft_content`, `draft_hero_image`
- `published_at` (when provided)
- `updated_at`
- Taxonomies (categories, tags, content type)

It **never** updates:

- `showcase_data` ❌
- `display_options` ❌
- `source_name`, `original_url` ❌
- `meta_title`, `meta_description`, `canonical_url` ❌
- `slug` ❌

By contrast, `createPost` **does** persist `showcase_data` and `display_options`. New posts work; edits lose data.

---

## 3. The Preview Mechanism

### How Preview Fetches Data

- Admin preview: `/admin/preview/[id]` (client component).
- Fetches directly from Supabase with a `.select()` that includes `showcase_data`, `display_options`, and all `draft_*` columns.
- Uses draft fields for title, content, excerpt, featured image.
- Uses `showcase_data` and `display_options` directly from the DB (no draft variants exist for these).

### Why Products and People Fail in Preview

- Preview reads `showcase_data` and `display_options` from the database.
- `updatePost` never writes them.
- After Save Draft, the DB still has the previous values (or empty for new posts).
- Preview therefore shows stale or empty Products/People.

### Data Flow Summary

```
Editor (showcaseData state)
    → buildPostFormData() → FormData with showcase_data
    → updatePost() → IGNORES showcase_data
    → DB showcase_data unchanged
    → Preview fetches DB → old/empty showcase_data
```

---

## 4. Additional Gaps

### Fields Not Persisted by `updatePost`

| Field | In Form? | In updatePost? |
|-------|----------|----------------|
| `showcase_data` | ✅ | ❌ |
| `display_options` | ✅ | ❌ |
| `source_name` | ✅ | ❌ |
| `original_url` | ✅ | ❌ |
| `meta_title` | ✅ | ❌ |
| `meta_description` | ✅ | ❌ |
| `canonical_url` | ✅ | ❌ |
| `slug` | ✅ | ❌ |

### `publishPost` Behavior

- Copies `draft_*` → published columns.
- Does not read or update `showcase_data` or `display_options`.
- Those columns are shared (no draft variant); they should be updated when saving drafts, not only on publish.

---

## 5. Newsletter Comparison

Newsletter save draft includes:

- `subject`, `slug`, `preview_text`, `featured_image`, `content`, `target_config`
- All are persisted by the newsletter update action.

Newsletters do not have a Products/People–style block, so they are not affected by this bug.

---

## 6. Recommended Fix

Update `updatePost` in `app/(admin)/admin/posts/actions.ts` to:

1. Parse `showcase_data` and `display_options` from FormData (same logic as `createPost`).
2. Add `showcase_data` and `display_options` to the `payload` passed to `client.from("posts").update(...)`.
3. Optionally add `source_name`, `original_url`, `meta_title`, `meta_description`, `canonical_url`, and `slug` to the payload if those edits should be saved on draft.

---

## File References

| File | Purpose |
|------|---------|
| `app/(admin)/admin/posts/edit-post-form.tsx` | Post form state, `buildPostFormData`, `handleSave` |
| `app/(admin)/admin/posts/actions.ts` | `createPost`, `updatePost`, `publishPost` |
| `app/components/admin/posts/ShowcaseManager.tsx` | Products/People block editor |
| `app/(admin)/admin/preview/[id]/page.tsx` | Admin preview page |
| `lib/data.ts` | `getPostBySlug`, `getPostByIdForPreviewWithClient` |
| `supabase/migrations/20260210240000_phase_29_showcase_data.sql` | `showcase_data` column |
| `supabase/migrations/20260210250000_phase_29_display_options.sql` | `display_options` column |
| `supabase/migrations/20260214000000_posts_draft_columns.sql` | Draft columns |
