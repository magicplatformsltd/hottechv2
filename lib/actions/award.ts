"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { ProductAwardRecord, AwardStyleSettings, AwardTier } from "@/lib/types/award";

const AWARDS_PATH = "/admin/products/awards";

export async function getAwards(): Promise<ProductAwardRecord[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("product_awards")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("[getAwards]", error);
    return [];
  }
  return (data ?? []) as ProductAwardRecord[];
}

export async function getAwardById(id: string): Promise<ProductAwardRecord | null> {
  if (!id?.trim()) return null;
  const client = await createClient();
  const { data, error } = await client
    .from("product_awards")
    .select("*")
    .eq("id", id.trim())
    .maybeSingle();

  if (error) {
    console.error("[getAwardById]", error);
    return null;
  }
  return data as ProductAwardRecord | null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "award";
}

export async function upsertAward(
  data: Partial<ProductAwardRecord>
): Promise<{ award?: ProductAwardRecord; error?: string }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const id = data.id?.trim();
  const name = (data.name ?? "").trim();
  const slug = (data.slug ?? "").trim() || slugify(name);
  const tierRaw = (data.tier ?? "FLAT").toString().toUpperCase();
  const tier: AwardTier =
    tierRaw === "GOLD" || tierRaw === "SILVER" || tierRaw === "BRONZE" ? tierRaw : "FLAT";
  const icon = (data.icon ?? "Award").trim() || "Award";
  const logo_url = (data.logo_url ?? null) && String(data.logo_url).trim() ? String(data.logo_url).trim() : null;
  const rawStyle = data.style_settings as AwardStyleSettings | undefined;
  const shapeVal = rawStyle?.shape ?? (rawStyle?.is_hexagon ? "hexagon" : "circle");
  const validShape =
    shapeVal === "hexagon" || shapeVal === "square" || shapeVal === "diamond" ? shapeVal : "circle";
  const clamp = (n: number) => Math.min(10, Math.max(0, n));
  const outerDepth =
    typeof rawStyle?.outer_depth === "number"
      ? clamp(rawStyle.outer_depth)
      : typeof rawStyle?.depth === "number"
        ? clamp(rawStyle.depth)
        : 0;
  const innerDepth =
    typeof rawStyle?.inner_depth === "number" ? clamp(rawStyle.inner_depth) : 0;
  const labelFontSize =
    typeof rawStyle?.label_font_size === "number"
      ? Math.min(10, Math.max(0, rawStyle.label_font_size))
      : 0;
  const logoScale =
    typeof rawStyle?.logo_scale === "number"
      ? Math.min(1.5, Math.max(0.5, rawStyle.logo_scale))
      : 1;
  const logoYOffset =
    typeof rawStyle?.logo_y_offset === "number"
      ? Math.min(50, Math.max(-20, rawStyle.logo_y_offset))
      : 0;
  const labelYOffset =
    typeof rawStyle?.label_y_offset === "number"
      ? Math.min(30, Math.max(-30, rawStyle.label_y_offset))
      : 0;
  const style_settings: AwardStyleSettings = {
    bg_color: rawStyle?.bg_color ?? "rgba(234,179,8,0.2)",
    text_color: rawStyle?.text_color ?? "#eab308",
    border_style: rawStyle?.border_style ?? "solid",
    is_hexagon: validShape === "hexagon",
    shape: validShape,
    bezel_color: rawStyle?.bezel_color ?? undefined,
    shield_color: rawStyle?.shield_color ?? undefined,
    outer_depth: outerDepth,
    inner_depth: innerDepth,
    isCustom: Boolean(rawStyle?.isCustom),
    label_font_size: labelFontSize,
    logo_scale: logoScale,
    logo_y_offset: logoYOffset,
    label_y_offset: labelYOffset,
  };

  if (id) {
    const { data: updated, error } = await client
      .from("product_awards")
      .update({ name, slug, tier, icon, logo_url, style_settings })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[upsertAward] update", error);
      return { error: error.message };
    }
    revalidatePath(AWARDS_PATH);
    revalidatePath("/");
    return { award: updated as ProductAwardRecord };
  }

  if (!name) return { error: "Name is required." };

  const { data: created, error } = await client
    .from("product_awards")
    .insert({ name, slug, tier, icon, logo_url, style_settings })
    .select()
    .single();

  if (error) {
    console.error("[upsertAward] insert", error);
    return { error: error.message };
  }
  revalidatePath(AWARDS_PATH);
  revalidatePath("/");
  return { award: created as ProductAwardRecord };
}

export async function deleteAward(id: string): Promise<{ error?: string }> {
  if (!id?.trim()) return { error: "Award id is required." };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const { error } = await client
    .from("product_awards")
    .delete()
    .eq("id", id.trim());

  if (error) {
    console.error("[deleteAward]", error);
    return { error: error.message };
  }
  revalidatePath(AWARDS_PATH);
  revalidatePath("/");
  return {};
}
