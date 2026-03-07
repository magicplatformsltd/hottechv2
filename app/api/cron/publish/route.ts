import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

/**
 * Cron: Bust cache when scheduled posts and products go live.
 * Runs every minute; finds items whose published_at crossed into the past in the last 2 minutes.
 * (1) Posts with status published and published_at in window → revalidate.
 * (2) Products with status published and published_at in window → revalidate.
 * One failure does not stop the other.
 */
export async function GET() {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
  const nowIso = now.toISOString();
  const twoMinutesAgoIso = twoMinutesAgo.toISOString();

  const supabase = await createClient();
  let postsWentLive = 0;
  let productsWentLive = 0;
  const postIds: string[] = [];
  const productIds: string[] = [];

  try {
    const { data: posts, error } = await supabase
      .from("posts")
      .select("id")
      .eq("status", "published")
      .gte("published_at", twoMinutesAgoIso)
      .lte("published_at", nowIso);

    if (error) {
      console.error("[cron/publish] posts", error);
    } else {
      postsWentLive = posts?.length ?? 0;
      if (posts?.length) postIds.push(...posts.map((p) => p.id));
      if (postsWentLive > 0) revalidatePath("/", "layout");
    }
  } catch (err) {
    console.error("[cron/publish] posts error", err);
  }

  try {
    const { data: products, error } = await supabase
      .from("products")
      .select("id")
      .eq("status", "published")
      .gte("published_at", twoMinutesAgoIso)
      .lte("published_at", nowIso);

    if (error) {
      console.error("[cron/publish] products", error);
    } else {
      productsWentLive = products?.length ?? 0;
      if (products?.length) productIds.push(...products.map((p) => p.id));
      if (productsWentLive > 0) revalidatePath("/", "layout");
    }
  } catch (err) {
    console.error("[cron/publish] products error", err);
  }

  const revalidated = postsWentLive > 0 || productsWentLive > 0;

  return NextResponse.json({
    postsWentLive,
    productsWentLive,
    revalidated,
    postIds,
    productIds,
  });
}
