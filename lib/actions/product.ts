"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Product,
  ProductSpecs,
  AffiliateLinks,
  EditorialData,
  ProductDraftData,
  ProductSpecsNested,
} from "@/lib/types/product";
import type { SpecGroup, SpecItem } from "@/lib/types/template";
import { getOrCreateBrandWithClient } from "@/lib/actions/brand";

/** Build a row payload for products table from Partial<Product>, omitting undefined and handling JSONB. */
function toProductRow(data: Partial<Product>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.brand_id !== undefined) row.brand_id = data.brand_id;
  if (data.slug !== undefined) row.slug = data.slug;
  if (data.announcement_date !== undefined) row.announcement_date = data.announcement_date ?? null;
  if (data.release_date !== undefined) row.release_date = data.release_date ?? null;
  if (data.discontinued_date !== undefined) row.discontinued_date = data.discontinued_date ?? null;
  if (data.software_updates_years !== undefined) row.software_updates_years = data.software_updates_years ?? null;
  if (data.security_updates_years !== undefined) row.security_updates_years = data.security_updates_years ?? null;
  if (data.hero_image !== undefined) row.hero_image = data.hero_image ?? null;
  if (data.transparent_image !== undefined) row.transparent_image = data.transparent_image ?? null;
  if (data.template_id !== undefined) row.template_id = data.template_id ?? null;
  if (data.category_id !== undefined) row.category_id = data.category_id ?? null;
  if (data.seo_title !== undefined) row.seo_title = data.seo_title ?? null;
  if (data.seo_description !== undefined) row.seo_description = data.seo_description ?? null;
  if (data.award_id !== undefined) row.award_id = data.award_id ?? null;
  if (data.specs !== undefined) row.specs = data.specs ?? {};
  if (data.affiliate_links !== undefined) row.affiliate_links = data.affiliate_links ?? {};
  if (data.editorial_data !== undefined) row.editorial_data = data.editorial_data ?? {};
  if (data.status !== undefined) row.status = data.status ?? "draft";
  if (data.published_at !== undefined) row.published_at = data.published_at ?? null;
  if (data.draft_data !== undefined) row.draft_data = data.draft_data ?? null;
  return row;
}

/** Build ProductDraftData from form/update payload for storing in draft_data column. */
function buildDraftDataFromPayload(data: Partial<Product>): ProductDraftData {
  return {
    name: data.name ?? undefined,
    brand_id: data.brand_id ?? undefined,
    slug: data.slug ?? undefined,
    template_id: data.template_id ?? undefined,
    specs: data.specs ?? undefined,
    editorial_data: data.editorial_data ?? undefined,
    affiliate_links: data.affiliate_links ?? undefined,
    hero_image: data.hero_image ?? undefined,
    transparent_image: data.transparent_image ?? undefined,
    seo_title: data.seo_title ?? undefined,
    seo_description: data.seo_description ?? undefined,
    announcement_date: data.announcement_date ?? undefined,
    release_date: data.release_date ?? undefined,
    discontinued_date: data.discontinued_date ?? undefined,
    software_updates_years: data.software_updates_years ?? undefined,
    security_updates_years: data.security_updates_years ?? undefined,
    category_id: data.category_id ?? undefined,
    award_id: data.award_id ?? undefined,
    status: data.status ?? undefined,
    published_at: data.published_at ?? undefined,
  };
}

/**
 * Normalize extracted data using the template's field types.
 * - Numbers: coerce to number (integer).
 * - Booleans: convert "Yes"/"No" (case-insensitive) to true/false or { value, details }.
 * - Structured forms (camera_lens, display_panel): if AI returned a flat string, wrap in the primary key so it doesn't disappear in the UI.
 */
export async function applyTemplateTypes(
  data: ProductSpecsNested,
  templateFields: SpecGroup[]
): Promise<ProductSpecsNested> {
  const out: ProductSpecsNested = {};
  for (const group of templateFields) {
    const groupName = group.groupName?.trim() || "General";
    const fromData = data[groupName];
    if (!out[groupName]) out[groupName] = {};
    for (const spec of group.specs ?? []) {
      const specName = spec.name?.trim();
      if (!specName) continue;
      const type: SpecItem["type"] = (spec as SpecItem).type ?? "text";
      let val = fromData && typeof fromData === "object" ? (fromData as Record<string, unknown>)[specName] : undefined;

      if (val === undefined || val === null) continue;

      if (type === "boolean") {
        if (typeof val === "string") {
          const lower = (val as string).toLowerCase().trim();
          out[groupName]![specName] = {
            value: lower === "yes" || lower === "true" || lower === "1",
            details: "",
          };
        } else if (typeof val === "object" && val !== null && "value" in val) {
          const v = val as { value?: boolean; details?: string };
          out[groupName]![specName] = {
            value: Boolean(v.value),
            details: typeof v.details === "string" ? v.details : "",
          };
        }
        continue;
      }

      if (type === "variant_matrix") {
        const arr = Array.isArray(val) ? val : [];
        out[groupName]![specName] = arr.map((x) => {
          const o = x && typeof x === "object" ? x as Record<string, unknown> : {};
          return {
            value1: String(o.value1 ?? o.ram ?? "").trim(),
            value2: String(o.value2 ?? o.storage ?? "").trim(),
          };
        });
        continue;
      }

      if (type === "ip_rating") {
        const arr = Array.isArray(val) ? val : [];
        out[groupName]![specName] = arr.map((x) => {
          const o = x && typeof x === "object" ? x as Record<string, unknown> : {};
          return {
            dust: String(o.dust ?? "X").trim(),
            water: String(o.water ?? "X").trim(),
          };
        });
        continue;
      }

      if (type === "camera_lens") {
        if (typeof val === "string" && (val as string).trim()) {
          out[groupName]![specName] = {
            mp: (val as string).trim(),
            aperture: "",
            focalLength: "",
            fov: "",
            lensType: "",
            sensorSize: "",
            pixelSize: "",
            autofocus: "",
            zoom: "",
            ois: false,
          };
        } else if (typeof val === "object" && val !== null && "mp" in val) {
          const o = val as Record<string, unknown>;
          out[groupName]![specName] = {
            mp: String(o.mp ?? "").trim(),
            aperture: String(o.aperture ?? "").trim(),
            focalLength: String(o.focalLength ?? "").trim(),
            fov: String(o.fov ?? "").trim(),
            lensType: String(o.lensType ?? "").trim(),
            sensorSize: String(o.sensorSize ?? "").trim(),
            pixelSize: String(o.pixelSize ?? "").trim(),
            autofocus: String(o.autofocus ?? "").trim(),
            zoom: String(o.zoom ?? "").trim(),
            ois: Boolean(o.ois),
          };
        }
        continue;
      }

      if (type === "display_panel") {
        if (typeof val === "string" && (val as string).trim()) {
          out[groupName]![specName] = {
            displayName: (val as string).trim(),
            diagonalSize: "",
            screenToBodyRatio: "",
            panelType: "",
            colorDepth: "",
            resolution: "",
            aspectRatio: "",
            pixelDensity: "",
            refreshRate: "",
            pwm: "",
            hbmBrightness: "",
            peakBrightness: "",
            protection: "",
            hasDolbyVision: false,
            hasHDR10Plus: false,
            otherFeatures: "",
          };
        } else if (typeof val === "object" && val !== null && "displayName" in val) {
          const o = val as Record<string, unknown>;
          out[groupName]![specName] = {
            displayName: String(o.displayName ?? "").trim(),
            diagonalSize: String(o.diagonalSize ?? "").trim(),
            screenToBodyRatio: String(o.screenToBodyRatio ?? "").trim(),
            panelType: String(o.panelType ?? "").trim(),
            colorDepth: String(o.colorDepth ?? "").trim(),
            resolution: String(o.resolution ?? "").trim(),
            aspectRatio: String(o.aspectRatio ?? "").trim(),
            pixelDensity: String(o.pixelDensity ?? "").trim(),
            refreshRate: String(o.refreshRate ?? "").trim(),
            pwm: String(o.pwm ?? "").trim(),
            hbmBrightness: String(o.hbmBrightness ?? "").trim(),
            peakBrightness: String(o.peakBrightness ?? "").trim(),
            protection: String(o.protection ?? "").trim(),
            hasDolbyVision: Boolean(o.hasDolbyVision),
            hasHDR10Plus: Boolean(o.hasHDR10Plus),
            otherFeatures: String(o.otherFeatures ?? "").trim(),
          };
        }
        continue;
      }

      if (type === "number") {
        const digitsOnly = (typeof val === "string" ? val : String(val)).replace(/[^0-9]/g, "");
        const n = digitsOnly.length > 0 ? parseInt(digitsOnly, 10) : NaN;
        out[groupName]![specName] = !Number.isNaN(n) ? String(n) : (typeof val === "string" ? val : String(val));
        continue;
      }

      if (type === "text" || !type) {
        out[groupName]![specName] = typeof val === "string" ? val : String(val);
      }
    }
  }
  return out;
}

export async function getProducts(): Promise<Product[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getProducts]", error);
    return [];
  }
  return (data ?? []) as Product[];
}

export async function getProductById(id: string): Promise<Product | null> {
  if (!id?.trim()) return null;
  const client = await createClient();
  const { data, error } = await client
    .from("products")
    .select("*, brands(*)")
    .eq("id", id.trim())
    .maybeSingle();

  if (error) {
    console.error("[getProductById]", error);
    return null;
  }
  return data as Product | null;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!slug?.trim()) return null;
  const client = await createClient();
  const { data, error } = await client
    .from("products")
    .select("*, brands(*)")
    .eq("slug", slug.trim())
    .maybeSingle();

  if (error) {
    console.error("[getProductBySlug]", error);
    return null;
  }
  return data as Product | null;
}

export async function getProductsByTemplateId(templateId: string): Promise<Product[]> {
  if (!templateId?.trim()) return [];
  const client = await createClient();
  const { data, error } = await client
    .from("products")
    .select("*, brands(*)")
    .eq("template_id", templateId.trim())
    .order("name", { ascending: true });

  if (error) {
    console.error("[getProductsByTemplateId]", error);
    return [];
  }
  return (data ?? []) as Product[];
}

export async function upsertProduct(
  data: Partial<Product>
): Promise<{ product?: Product; error?: string }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { error: "Unauthorized." };
  }

  const id = data.id?.trim();

  if (id) {
    const current = await getProductById(id);
    const isDraftOrPending =
      current?.status === "draft" || current?.status === "pending_review";

    if (isDraftOrPending) {
      const draft_data = buildDraftDataFromPayload(data);
      const row = toProductRow({
        draft_data,
        published_at: data.published_at !== undefined ? data.published_at ?? null : current?.published_at ?? null,
        status: data.status !== undefined ? data.status ?? "draft" : (current?.status ?? "draft"),
      });
      const { data: updated, error } = await client
        .from("products")
        .update(row)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("[upsertProduct] update draft_data", error);
        return { error: error.message };
      }
      revalidatePath("/admin/products");
      revalidatePath(`/admin/products/${id}`);
      revalidatePath("/");
      return { product: updated as Product };
    }

    const row = toProductRow(data);
    const { data: updated, error } = await client
      .from("products")
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[upsertProduct] update", error);
      return { error: error.message };
    }
    revalidatePath("/admin/products");
    revalidatePath("/");
    return { product: updated as Product };
  }

  const name = (data.name ?? "").trim();
  const brandId = data.brand_id ?? null;
  const slug = (data.slug ?? "").trim();
  if (!name || !slug) {
    return { error: "name and slug are required to create a product." };
  }
  if (!brandId && !data.id) {
    return { error: "Brand is required to create a product." };
  }

  const insertPayload: Partial<Product> = {
    name,
    brand_id: brandId,
    slug,
    announcement_date: data.announcement_date ?? null,
    release_date: data.release_date ?? null,
    discontinued_date: data.discontinued_date ?? null,
    software_updates_years: data.software_updates_years ?? null,
    security_updates_years: data.security_updates_years ?? null,
    hero_image: data.hero_image ?? null,
    transparent_image: data.transparent_image ?? null,
    template_id: data.template_id ?? null,
    category_id: data.category_id ?? null,
    seo_title: data.seo_title ?? null,
    seo_description: data.seo_description ?? null,
    award_id: data.award_id ?? null,
    specs: (data.specs ?? {}) as ProductSpecs,
    affiliate_links: (data.affiliate_links ?? []) as AffiliateLinks,
    editorial_data: (data.editorial_data ?? {}) as EditorialData,
    status: data.status ?? "draft",
    published_at: data.published_at ?? null,
    draft_data: data.draft_data ?? null,
  };
  const insertRow = toProductRow(insertPayload);

  const { data: created, error } = await client
    .from("products")
    .insert(insertRow)
    .select()
    .single();

  if (error) {
    console.error("[upsertProduct] insert", error);
    return { error: error.message };
  }
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { product: created as Product };
}

/** Payload for importing a product (e.g. from AI extraction). All editable fields go into draft_data; live row is minimal until approved. */
export type ImportProductPayload = {
  name: string;
  brand: string;
  slug: string;
  template_id: string;
  /** Optional; stored in draft_data. */
  specs?: Product["specs"];
  editorial_data?: EditorialData;
  affiliate_links?: AffiliateLinks;
  hero_image?: string | null;
  transparent_image?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  announcement_date?: string | null;
  release_date?: string | null;
  discontinued_date?: string | null;
  software_updates_years?: number | null;
  security_updates_years?: number | null;
  category_id?: number | null;
  award_id?: string | null;
};

/**
 * Import a product using a provided Supabase client (e.g. service role). Skips auth check.
 * Use from API routes (e.g. test-extract) when there is no user session. Keeps [importProduct] logs.
 */
export async function importProductWithClient(
  client: SupabaseClient,
  incoming: ImportProductPayload
): Promise<{ product?: Product; error?: string }> {
  return doImportProduct(client, incoming);
}

/**
 * Import a product (e.g. from AI extraction or CSV). Uses cookie-based client; requires authenticated user.
 * Uses dual-state model: status 'pending_review', published_at null, incoming data in draft_data.
 *
 * For sessionless calls (e.g. curl to test-extract), use importProductWithClient with a service role client.
 */
export async function importProduct(
  incoming: ImportProductPayload
): Promise<{ product?: Product; error?: string }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { error: "Unauthorized." };
  }
  return doImportProduct(client, incoming);
}

async function doImportProduct(
  client: SupabaseClient,
  incoming: ImportProductPayload
): Promise<{ product?: Product; error?: string }> {
  const name = (incoming.name ?? "").trim();
  const brandName = (incoming.brand ?? "").trim();
  const slug = (incoming.slug ?? "").trim();
  const templateId = (incoming.template_id ?? "").trim();
  if (!name || !brandName || !slug || !templateId) {
    return { error: "name, brand, slug, and template_id are required to import a product." };
  }

  const brandId = await getOrCreateBrandWithClient(client, brandName);
  if (!brandId) {
    return { error: "Could not resolve or create brand." };
  }

  const draft_data: ProductDraftData = {
    name,
    brand_id: brandId,
    slug,
    template_id: templateId,
    specs: incoming.specs ?? {},
    editorial_data: incoming.editorial_data ?? {},
    affiliate_links: incoming.affiliate_links ?? [],
    hero_image: incoming.hero_image ?? null,
    transparent_image: incoming.transparent_image ?? null,
    seo_title: incoming.seo_title ?? null,
    seo_description: incoming.seo_description ?? null,
    announcement_date: incoming.announcement_date ?? null,
    release_date: incoming.release_date ?? null,
    discontinued_date: incoming.discontinued_date ?? null,
    software_updates_years: incoming.software_updates_years ?? null,
    security_updates_years: incoming.security_updates_years ?? null,
    category_id: incoming.category_id ?? null,
    award_id: incoming.award_id ?? null,
  };

  const payload: Partial<Product> = {
    name,
    brand_id: brandId,
    slug,
    template_id: templateId,
    status: "pending_review",
    published_at: null,
    specs: {},
    affiliate_links: [],
    editorial_data: {},
    draft_data,
  };

  const row = toProductRow(payload);

  // Debug: log row keys and draft_data presence (full row can be large)
  const rowKeys = Object.keys(row);
  const hasDraftData = "draft_data" in row && row.draft_data != null;
  console.log("[importProduct] insert row keys:", rowKeys.join(", "), "| draft_data present:", hasDraftData, "| status:", row.status);

  const { data: created, error } = await client
    .from("products")
    .insert(row)
    .select("*, brands(*)")
    .single();

  if (error) {
    const errMsg = error?.message ?? String(error);
    const errCode = (error as { code?: string })?.code;
    const errDetails = (error as { details?: string })?.details;
    console.error("[importProduct] Supabase insert FAILED:", {
      message: errMsg,
      code: errCode,
      details: errDetails,
      hint: errCode === "42501" ? "RLS/Permission Denied" : errCode === "23505" ? "Unique violation (e.g. slug)" : "Check code for schema/constraint",
    });
    return { error: errMsg };
  }

  if (created == null) {
    console.error("[importProduct] insert returned no error but data is null/empty (possible RLS on SELECT after insert)");
    return { error: "Insert succeeded but row could not be read back. Check RLS policies for SELECT." };
  }

  console.log("[importProduct] insert success, id:", (created as { id?: string })?.id);
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { product: created as Product };
}

/**
 * Publish draft: merge draft_data into live columns, clear draft_data, set status to published (or scheduled when date is in the future).
 * Call from the product edit page "Publish" / "Schedule" button.
 * @param id - Product id
 * @param publishedAt - Optional ISO date string; if in the future, product is scheduled (status remains "published", badge shows "Scheduled").
 */
export async function publishProductDraft(
  id: string,
  publishedAt?: string | null
): Promise<{ product?: Product; error?: string }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { error: "Unauthorized." };
  }

  const product = await getProductById(id);
  if (!product) {
    return { error: "Product not found." };
  }

  const draft = product.draft_data;
  const at = (publishedAt ?? "").trim();
  const useDate = at ? new Date(at) : new Date();
  const merged: Partial<Product> = {
    name: (draft?.name ?? product.name) ?? "",
    brand_id: draft?.brand_id ?? product.brand_id ?? null,
    slug: (draft?.slug ?? product.slug) ?? "",
    announcement_date: draft?.announcement_date ?? product.announcement_date ?? null,
    release_date: draft?.release_date ?? product.release_date ?? null,
    discontinued_date: draft?.discontinued_date ?? product.discontinued_date ?? null,
    software_updates_years: draft?.software_updates_years ?? product.software_updates_years ?? null,
    security_updates_years: draft?.security_updates_years ?? product.security_updates_years ?? null,
    hero_image: draft?.hero_image ?? product.hero_image ?? null,
    transparent_image: draft?.transparent_image ?? product.transparent_image ?? null,
    template_id: draft?.template_id ?? product.template_id ?? null,
    category_id: draft?.category_id ?? product.category_id ?? null,
    seo_title: draft?.seo_title ?? product.seo_title ?? null,
    seo_description: draft?.seo_description ?? product.seo_description ?? null,
    award_id: draft?.award_id ?? product.award_id ?? null,
    specs: (draft?.specs ?? product.specs) ?? {},
    affiliate_links: (draft?.affiliate_links ?? product.affiliate_links) ?? [],
    editorial_data: (draft?.editorial_data ?? product.editorial_data) ?? {},
    status: "published",
    published_at: useDate.toISOString(),
    draft_data: null,
  };

  const row = toProductRow(merged);

  const { data: updated, error } = await client
    .from("products")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[publishProductDraft]", error);
    return { error: error.message };
  }
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/");
  return { product: updated as Product };
}

export async function deleteProduct(id: string): Promise<{ error?: string }> {
  if (!id?.trim()) return { error: "Product id is required." };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { error: "Unauthorized." };
  }

  const { error } = await client.from("products").delete().eq("id", id.trim());

  if (error) {
    console.error("[deleteProduct]", error);
    return { error: error.message };
  }
  revalidatePath("/admin/products");
  revalidatePath("/");
  return {};
}

export async function searchProducts(query: string): Promise<Product[]> {
  const q = (query ?? "").trim();
  if (!q) return [];
  const client = await createClient();
  const pattern = `%${String(q).replace(/"/g, '\\"')}%`;
  const { data, error } = await client
    .from("products")
    .select("*, brands(*)")
    .or(`name.ilike."${pattern}",brands.name.ilike."${pattern}"`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[searchProducts]", error);
    return [];
  }
  return (data ?? []) as Product[];
}

/** Linked product with is_primary from post_products junction. */
export type LinkedProduct = { product: Product; is_primary: boolean };

const EDITOR_PATH = "/admin/posts";

export async function getLinkedProducts(postId: string): Promise<LinkedProduct[]> {
  if (!postId?.trim()) return [];
  const client = await createClient();
  const { data, error } = await client
    .from("post_products")
    .select("product_id, is_primary, products(*, brands(*))")
    .eq("post_id", postId.trim())
    .order("is_primary", { ascending: false });

  if (error) {
    console.error("[getLinkedProducts]", error);
    return [];
  }
  const rows = (data ?? []) as unknown as { product_id: string; is_primary: boolean; products: Product | null }[];
  return rows
    .filter((row) => row.products != null)
    .map((row) => ({ product: row.products as Product, is_primary: row.is_primary }));
}

export async function linkProductToPost(
  postId: string,
  productId: string
): Promise<{ error?: string }> {
  if (!postId?.trim() || !productId?.trim()) {
    return { error: "Post ID and product ID are required." };
  }
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const alreadyLinked = await client
    .from("post_products")
    .select("product_id")
    .eq("post_id", postId.trim())
    .eq("product_id", productId.trim())
    .maybeSingle();

  if (alreadyLinked.data) {
    return {};
  }

  const existing = await client
    .from("post_products")
    .select("product_id")
    .eq("post_id", postId.trim());
  const isFirst = (existing.data?.length ?? 0) === 0;

  const { error } = await client.from("post_products").insert({
    post_id: postId.trim(),
    product_id: productId.trim(),
    is_primary: isFirst,
  });

  if (error) {
    console.error("[linkProductToPost]", error);
    return { error: error.message };
  }

  if (isFirst) {
    await client.from("posts").update({ primary_product_id: productId.trim() }).eq("id", postId.trim());
  }
  revalidatePath(`${EDITOR_PATH}/${postId}`);
  revalidatePath("/");
  return {};
}

export async function unlinkProduct(
  postId: string,
  productId: string
): Promise<{ error?: string }> {
  if (!postId?.trim() || !productId?.trim()) {
    return { error: "Post ID and product ID are required." };
  }
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const { data: linkRow } = await client
    .from("post_products")
    .select("is_primary")
    .eq("post_id", postId.trim())
    .eq("product_id", productId.trim())
    .maybeSingle();
  const wasPrimary = linkRow != null && (linkRow as { is_primary?: boolean }).is_primary === true;

  const { error } = await client
    .from("post_products")
    .delete()
    .eq("post_id", postId.trim())
    .eq("product_id", productId.trim());

  if (error) {
    console.error("[unlinkProduct]", error);
    return { error: error.message };
  }

  if (wasPrimary) {
    const { data: next } = await client
      .from("post_products")
      .select("product_id")
      .eq("post_id", postId.trim())
      .eq("is_primary", true)
      .maybeSingle();
    const nextId = (next as { product_id?: string } | null)?.product_id ?? null;
    await client.from("posts").update({ primary_product_id: nextId }).eq("id", postId.trim());
  }
  revalidatePath(`${EDITOR_PATH}/${postId}`);
  revalidatePath("/");
  return {};
}

export async function setPrimaryProduct(
  postId: string,
  productId: string
): Promise<{ error?: string }> {
  if (!postId?.trim() || !productId?.trim()) {
    return { error: "Post ID and product ID are required." };
  }
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const { error: offError } = await client
    .from("post_products")
    .update({ is_primary: false })
    .eq("post_id", postId.trim());

  if (offError) {
    console.error("[setPrimaryProduct] clear", offError);
    return { error: offError.message };
  }

  const { error: onError } = await client
    .from("post_products")
    .update({ is_primary: true })
    .eq("post_id", postId.trim())
    .eq("product_id", productId.trim());

  if (onError) {
    console.error("[setPrimaryProduct] set", onError);
    return { error: onError.message };
  }

  await client.from("posts").update({ primary_product_id: productId.trim() }).eq("id", postId.trim());
  revalidatePath(`${EDITOR_PATH}/${postId}`);
  revalidatePath("/");
  return {};
}
