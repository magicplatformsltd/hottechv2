"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { Product, ProductSpecs, AffiliateLinks, EditorialData } from "@/lib/types/product";

/** Build a row payload for products table from Partial<Product>, omitting undefined and handling JSONB. */
function toProductRow(data: Partial<Product>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.brand !== undefined) row.brand = data.brand;
  if (data.slug !== undefined) row.slug = data.slug;
  if (data.release_date !== undefined) row.release_date = data.release_date ?? null;
  if (data.hero_image !== undefined) row.hero_image = data.hero_image ?? null;
  if (data.transparent_image !== undefined) row.transparent_image = data.transparent_image ?? null;
  if (data.template_id !== undefined) row.template_id = data.template_id ?? null;
  if (data.category_id !== undefined) row.category_id = data.category_id ?? null;
  if (data.seo_title !== undefined) row.seo_title = data.seo_title ?? null;
  if (data.seo_description !== undefined) row.seo_description = data.seo_description ?? null;
  if (data.specs !== undefined) row.specs = data.specs ?? {};
  if (data.affiliate_links !== undefined) row.affiliate_links = data.affiliate_links ?? {};
  if (data.editorial_data !== undefined) row.editorial_data = data.editorial_data ?? {};
  return row;
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
    .select("*")
    .eq("id", id.trim())
    .maybeSingle();

  if (error) {
    console.error("[getProductById]", error);
    return null;
  }
  return data as Product | null;
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
  const row = toProductRow(data);

  if (id) {
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
  const brand = (data.brand ?? "").trim();
  const slug = (data.slug ?? "").trim();
  if (!name || !brand || !slug) {
    return { error: "name, brand, and slug are required to create a product." };
  }

  const { data: created, error } = await client
    .from("products")
    .insert({
      name,
      brand,
      slug,
      release_date: data.release_date ?? null,
      hero_image: data.hero_image ?? null,
      transparent_image: data.transparent_image ?? null,
      template_id: data.template_id ?? null,
      category_id: data.category_id ?? null,
      seo_title: data.seo_title ?? null,
      seo_description: data.seo_description ?? null,
      specs: (data.specs ?? {}) as ProductSpecs,
      affiliate_links: (data.affiliate_links ?? {}) as AffiliateLinks,
      editorial_data: (data.editorial_data ?? {}) as EditorialData,
    })
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
    .select("*")
    .or(`name.ilike."${pattern}",brand.ilike."${pattern}"`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[searchProducts]", error);
    return [];
  }
  return (data ?? []) as Product[];
}
