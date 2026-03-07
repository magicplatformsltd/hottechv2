"use server";

import { createClient } from "@/utils/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brand } from "@/lib/types/product";

/** Look up brand by name or create; returns brand id. For use in import flow with existing client. */
export async function getOrCreateBrandWithClient(
  client: SupabaseClient,
  name: string
): Promise<string | null> {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  const { data: existing } = await client
    .from("brands")
    .select("id")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const slug =
    trimmed
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") || trimmed.toLowerCase();
  const { data: created, error } = await client
    .from("brands")
    .insert({ name: trimmed, slug })
    .select("id")
    .single();
  if (error || !created?.id) return null;
  return created.id;
}

export async function getBrands(): Promise<Brand[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("brands")
    .select("id, name, slug, logo_url, description, created_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("[getBrands]", error);
    return [];
  }
  return (data ?? []) as Brand[];
}

export async function createBrand(name: string, slug?: string): Promise<{ brand?: Brand; error?: string }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const trimmedName = (name ?? "").trim();
  if (!trimmedName) return { error: "Brand name is required." };

  const slugValue =
    (slug ?? "").trim() ||
    trimmedName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  const { data, error } = await client
    .from("brands")
    .insert({ name: trimmedName, slug: slugValue || trimmedName.toLowerCase() })
    .select()
    .single();

  if (error) {
    console.error("[createBrand]", error);
    return { error: error.message };
  }
  return { brand: data as Brand };
}
