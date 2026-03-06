/**
 * One-time "Great Migration" action: localize all authory.com assets in existing posts.
 * Run via POST with CRON_SECRET or as an allowed admin.
 *
 * Query all posts where any image field contains authory.com, download each image,
 * upload to Supabase storage, add to media_items, then update the post record.
 * On per-image failure, logs Post ID and URL for manual investigation and continues.
 */

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import {
  extractAllAuthoryUrls,
  localizeImageUrlSafe,
  replaceUrlsInPostFields,
  type PostImageFields,
} from "@/lib/asset-localization";

const ALLOWED_ADMIN_EMAILS = ["web@nirave.co"];

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}

type PostRow = {
  id: string;
  featured_image: string | null;
  main_image: string | null;
  draft_hero_image: string | null;
  content: string | null;
  showcase_data: unknown;
};

export async function POST() {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  let isAdmin = false;
  if (!isCron) {
    const supabaseAuth = await createServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    const email = user?.email?.toLowerCase().trim();
    isAdmin = !!user && !!email && ALLOWED_ADMIN_EMAILS.includes(email);
  }

  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: posts, error: fetchError } = await supabase
      .from("posts")
      .select("id, featured_image, main_image, draft_hero_image, content, showcase_data")
      .order("id", { ascending: true });

    if (fetchError) {
      console.error("[localize-authory] Fetch posts failed:", fetchError);
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    const rows = (posts ?? []) as PostRow[];
    const withAuthory = rows.filter((p) => {
      const fields: PostImageFields = {
        featured_image: p.featured_image,
        main_image: p.main_image,
        draft_hero_image: p.draft_hero_image,
        content: p.content,
        showcase_data: p.showcase_data,
      };
      return extractAllAuthoryUrls(fields).length > 0;
    });

    const failedLog: { postId: string; url: string; error?: string }[] = [];
    let updated = 0;
    let skipped = 0;

    for (const post of withAuthory) {
      const fields: PostImageFields = {
        featured_image: post.featured_image,
        main_image: post.main_image,
        draft_hero_image: post.draft_hero_image,
        content: post.content,
        showcase_data: post.showcase_data,
      };
      const urls = extractAllAuthoryUrls(fields);
      const urlMap = new Map<string, string>();

      for (const url of urls) {
        const local = await localizeImageUrlSafe(supabase, url, {
          addToMediaLibrary: true,
        });
        if (local) {
          urlMap.set(url, local);
        } else {
          failedLog.push({ postId: post.id, url });
          console.warn("[localize-authory] Failed to localize image:", post.id, url);
        }
      }

      if (urlMap.size === 0) {
        skipped++;
        continue;
      }

      const replaced = replaceUrlsInPostFields(fields, urlMap);
      const { error: updateError } = await supabase
        .from("posts")
        .update({
          featured_image: replaced.featured_image ?? post.featured_image,
          main_image: replaced.main_image ?? post.main_image,
          draft_hero_image: replaced.draft_hero_image ?? post.draft_hero_image,
          content: replaced.content ?? post.content,
          showcase_data: replaced.showcase_data ?? post.showcase_data,
        })
        .eq("id", post.id);

      if (updateError) {
        console.error("[localize-authory] Update post failed:", post.id, updateError);
        failedLog.push({
          postId: post.id,
          url: "(update failed)",
          error: updateError.message,
        });
      } else {
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      totalPostsWithAuthory: withAuthory.length,
      updated,
      skipped,
      failedCount: failedLog.length,
      failedLog: failedLog.slice(0, 100),
    });
  } catch (e) {
    console.error("[localize-authory]", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Migration failed",
      },
      { status: 500 }
    );
  }
}
