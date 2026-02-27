import {
  getUnifiedFeed,
  getSiteSettings,
  getPostsByIds,
  getSmartFeedPosts,
} from "@/lib/data";
import type { HomepageBlock } from "@/lib/types";
import { Hero } from "@/components/home/hero";
import { FeedGrid } from "@/components/home/feed-grid";
import { Timeline } from "@/components/home/Timeline";
import { SocialPresence } from "@/components/home/social-presence";
import { ViewTracker } from "@/components/analytics/ViewTracker";

export const runtime = "nodejs";
export const revalidate = 3600;

export default async function Home() {
  const [feed, settings] = await Promise.all([
    getUnifiedFeed(),
    getSiteSettings(),
  ]);

  const layout: HomepageBlock[] = settings?.homepage_layout ?? [];

  const featureGridBlocks = layout.filter(
    (b) => b.type === "feature_grid" && b.enabled
  );
  const gridItemsByBlockId: Record<string, Awaited<ReturnType<typeof getPostsByIds>>> = {};
  if (featureGridBlocks.length > 0) {
    const results = await Promise.all(
      featureGridBlocks.map((b) =>
        getPostsByIds(
          ((b.data as any)?.postIds ?? []) as string[]
        )
      )
    );
    featureGridBlocks.forEach((b, i) => {
      gridItemsByBlockId[b.id] = results[i];
    });
  }

  const smartFeedBlocks = layout.filter(
    (b) => b.type === "smart_feed" && b.enabled
  );
  const smartFeedItemsByBlockId: Record<string, Awaited<ReturnType<typeof getSmartFeedPosts>>> = {};
  if (smartFeedBlocks.length > 0) {
    const results = await Promise.all(
      smartFeedBlocks.map((b) =>
        getSmartFeedPosts((b.data as any) ?? {})
      )
    );
    smartFeedBlocks.forEach((b, i) => {
      smartFeedItemsByBlockId[b.id] = results[i];
    });
  }

  return (
    <>
      <ViewTracker customPath="/" />
      {layout
        .filter((b) => b.enabled)
        .map((block) => {
          switch (block.type) {
            case "hero":
              return <Hero key={block.id} data={block.data as any} />;
            case "feature_grid": {
              const data = block.data as any;
              const items = gridItemsByBlockId[block.id] ?? [];
              const sectionTitle = data?.sectionTitle?.trim() ?? "";
              return (
                <FeedGrid
                  key={block.id}
                  items={items}
                  sectionTitle={sectionTitle || undefined}
                />
              );
            }
            case "timeline":
              return (
                <Timeline
                  key={block.id}
                  data={block.data as any}
                />
              );
            case "smart_feed": {
              const data = block.data as any;
              const items = smartFeedItemsByBlockId[block.id] ?? [];
              const sectionTitle = data?.title?.trim() ?? "";
              const buttonText = data?.buttonText?.trim();
              const buttonLink = data?.buttonLink?.trim();
              return (
                <FeedGrid
                  key={block.id}
                  items={items}
                  sectionTitle={sectionTitle || undefined}
                  buttonText={buttonText || undefined}
                  buttonLink={buttonLink || undefined}
                />
              );
            }
            default:
              return null;
          }
        })}
      <SocialPresence />
    </>
  );
}
