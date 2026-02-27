import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

/**
 * Cron: Bust cache when scheduled posts go live.
 * Runs every minute; finds posts that crossed the embargo threshold in the last 2 minutes.
 */
export async function GET() {
  const headersList = await headers();
  const isCron = headersList.get("x-vercel-cron") === "1";

  if (!isCron) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
  const nowIso = now.toISOString();
  const twoMinutesAgoIso = twoMinutesAgo.toISOString();

  const supabase = await createClient();
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id")
    .eq("status", "published")
    .gte("published_at", twoMinutesAgoIso)
    .lte("published_at", nowIso);

  if (error) {
    console.error("[cron/publish]", error);
    return NextResponse.json(
      { error: error.message, revalidated: false },
      { status: 500 }
    );
  }

  const count = posts?.length ?? 0;
  if (count > 0) {
    revalidatePath("/", "layout");
  }

  return NextResponse.json({
    postsWentLive: count,
    revalidated: count > 0,
    postIds: (posts ?? []).map((p) => p.id),
  });
}
