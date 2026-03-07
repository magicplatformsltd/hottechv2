"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { ProductTemplate } from "@/lib/types/product";

export async function getTemplates(): Promise<ProductTemplate[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("product_templates")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("[getTemplates]", error);
    return [];
  }
  return (data ?? []) as ProductTemplate[];
}

export async function getTemplateById(id: string): Promise<ProductTemplate | null> {
  if (!id?.trim()) return null;
  const client = await createClient();
  const { data, error } = await client
    .from("product_templates")
    .select("*")
    .eq("id", id.trim())
    .maybeSingle();

  if (error) {
    console.error("[getTemplateById]", error);
    return null;
  }
  return data as ProductTemplate | null;
}

export async function upsertTemplate(
  data: Partial<ProductTemplate>
): Promise<{ template?: ProductTemplate; error?: string }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { error: "Unauthorized." };
  }

  const id = data.id?.trim();
  const spec_schema = Array.isArray(data.spec_schema) ? data.spec_schema : [];
  const score_schema = Array.isArray(data.score_schema) ? data.score_schema : [];

  if (id) {
    const { data: updated, error } = await client
      .from("product_templates")
      .update({
        name: data.name,
        slug: data.slug,
        spec_schema,
        score_schema,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[upsertTemplate] update", error);
      return { error: error.message };
    }
    revalidatePath("/admin/products/templates");
    return { template: updated as ProductTemplate };
  }

  const name = (data.name ?? "").trim();
  const slug = (data.slug ?? "").trim();
  if (!name || !slug) {
    return { error: "Name and slug are required to create a template." };
  }

  const { data: created, error } = await client
    .from("product_templates")
    .insert({
      name,
      slug,
      spec_schema,
      score_schema,
    })
    .select()
    .single();

  if (error) {
    console.error("[upsertTemplate] insert", error);
    return { error: error.message };
  }
  revalidatePath("/admin/products/templates");
  return { template: created as ProductTemplate };
}

export async function deleteTemplate(id: string): Promise<{ error?: string }> {
  if (!id?.trim()) return { error: "Template id is required." };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { error: "Unauthorized." };
  }

  const { error } = await client
    .from("product_templates")
    .delete()
    .eq("id", id.trim());

  if (error) {
    console.error("[deleteTemplate]", error);
    return { error: error.message };
  }
  revalidatePath("/admin/products/templates");
  return {};
}
