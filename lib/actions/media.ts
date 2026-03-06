"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type MediaMetadata = {
  alt_text?: string | null;
  title?: string | null;
  source_credit?: string | null;
};

export async function updateMediaMetadata(
  mediaId: string,
  metadata: MediaMetadata
): Promise<{ error?: string }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { error: "Unauthorized." };
  }

  const { error } = await client
    .from("media_items")
    .update({
      alt_text: metadata.alt_text ?? null,
      title: metadata.title ?? null,
      source_credit: metadata.source_credit ?? null,
    })
    .eq("id", mediaId);

  if (error) {
    console.error("[updateMediaMetadata]", error);
    return { error: error.message };
  }

  revalidatePath("/admin/media");
  return {};
}

export async function updateMediaTags(
  mediaId: string,
  tagIds: number[]
): Promise<{ error?: string }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { error: "Unauthorized." };
  }

  const { error: deleteError } = await client
    .from("media_tag_map")
    .delete()
    .eq("media_id", mediaId);

  if (deleteError) {
    console.error("[updateMediaTags] delete", deleteError);
    return { error: deleteError.message };
  }

  if (tagIds.length > 0) {
    const rows = tagIds.map((tag_id) => ({ media_id: mediaId, tag_id }));
    const { error: insertError } = await client.from("media_tag_map").insert(rows);

    if (insertError) {
      console.error("[updateMediaTags] insert", insertError);
      return { error: insertError.message };
    }
  }

  revalidatePath("/admin/media");
  return {};
}

export async function saveMediaAsset(
  mediaId: string,
  metadata: MediaMetadata,
  tagIds: number[]
): Promise<{ error?: string }> {
  const metaResult = await updateMediaMetadata(mediaId, metadata);
  if (metaResult.error) return metaResult;

  const tagsResult = await updateMediaTags(mediaId, tagIds);
  if (tagsResult.error) return tagsResult;

  return {};
}
