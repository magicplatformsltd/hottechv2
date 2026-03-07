/**
 * Shared content logic for Posts and Products: draft vs live, status, scheduling, preview.
 * Use these helpers in routes and components; do not duplicate checks.
 */

/** Global status for posts and products. */
export type ContentStatus = "draft" | "published" | "pending_review";

/** Entity that has status and optional published_at (post or product). */
export type PublishableEntity = {
  status?: string | null;
  published_at?: string | null;
};

/**
 * True if the entity is visible to the public: status is "published" and published_at is not in the future.
 * Use for public routes; admins/editors can still access via auth checks in the route.
 */
export function isPublished(entity: PublishableEntity | null | undefined): boolean {
  if (!entity) return false;
  if (entity.status !== "published") return false;
  if (entity.published_at && new Date(entity.published_at) > new Date()) return false;
  return true;
}

/**
 * True if the request is in preview mode (draft content should be shown).
 * Checks searchParams for preview=true or a preview token.
 */
export function isPreviewMode(
  searchParams: Record<string, string | string[] | undefined> | null | undefined
): boolean {
  if (!searchParams) return false;
  const p = searchParams.preview;
  if (p === "true" || p === "1") return true;
  if (typeof p === "string" && p.length > 0) return true;
  const token = searchParams.preview_token ?? searchParams.token;
  if (typeof token === "string" && token.length > 0) return true;
  if (Array.isArray(token) && token.some((t) => typeof t === "string" && t.length > 0)) return true;
  return false;
}

/**
 * Whether to show draft content for display (e.g. product draft_data).
 * Only when preview mode is on; callers must enforce that the user is admin/editor when using this.
 */
export function shouldShowDraft(
  searchParams: Record<string, string | string[] | undefined> | null | undefined
): boolean {
  return isPreviewMode(searchParams);
}

/**
 * Product with optional draft_data (from lib/types/product).
 * Merges draft_data onto the base product for display when useDraft is true and draft_data exists.
 */
export function getProductForDisplay<T extends { draft_data?: Record<string, unknown> | null; [k: string]: unknown }>(
  product: T,
  useDraft: boolean
): T {
  if (!useDraft || !product.draft_data || typeof product.draft_data !== "object") return product;
  return { ...product, ...product.draft_data } as T;
}
