import type { Metadata } from "next";
import Image from "next/image";

export const revalidate = 3600;
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { getPostBySlug, getPostPrimaryCategoryName } from "@/lib/data";
import { constructMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { PreviewBanner } from "@/components/posts/PreviewBanner";
import { ShowcaseGrid } from "@/components/posts/ShowcaseGrid";
import { PostBody } from "@/components/posts/PostBody";
import { SponsorBlock } from "@/components/posts/SponsorBlock";
import type { SponsorBlockData } from "@/lib/types/post";
import { SocialEmbedEnhancer } from "@/components/posts/SocialEmbedEnhancer";
import { ViewTracker } from "@/components/analytics/ViewTracker";
import { AdminEditShortcut } from "@/components/admin/AdminEditShortcut";
import { getBaseUrl } from "@/lib/url";
import { createClient } from "@/utils/supabase/server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  if (post.status !== "published") return { title: "Preview" };
  // Embargo: don't expose metadata for future-dated posts (crawlers)
  if (post.published_at && new Date(post.published_at) > new Date()) return { title: "Preview" };
  const category = await getPostPrimaryCategoryName(post.id);
  return await constructMetadata({
    title: post.title ?? "Untitled",
    description: post.excerpt ?? undefined,
    image: post.featured_image ?? undefined,
    type: "article",
    canonical: post.slug ? `/${post.slug}` : undefined,
    templateType: "post",
    category: category ?? undefined,
  });
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const isPublished = post.status === "published";
  if (!isPublished) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) notFound();
    const isAuthor = post.user_id != null && post.user_id === user.id;
    const isAdmin =
      (user.app_metadata as { role?: string } | undefined)?.role === "admin" ||
      (user.user_metadata as { role?: string } | undefined)?.role === "admin";
    if (!isAuthor && !isAdmin) notFound();
  }

  // Embargo: block future-dated published posts for non-admins
  if (isPublished && post.published_at) {
    const pubDate = new Date(post.published_at);
    if (pubDate > new Date()) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const isAdmin =
        user &&
        ((user.app_metadata as { role?: string } | undefined)?.role === "admin" ||
          (user.user_metadata as { role?: string } | undefined)?.role === "admin");
      if (!isAdmin) notFound();
    }
  }

  const isDraftPreview = !isPublished;
  const date = post.updated_at ?? post.created_at;
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const articleUrl = post.slug ? `${baseUrl}/${post.slug}` : baseUrl;
  const imageUrl = post.featured_image
    ? post.featured_image.startsWith("http")
      ? post.featured_image
      : `${baseUrl}/${post.featured_image.replace(/^\//, "")}`
    : undefined;

  const newsArticleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title ?? "Untitled",
    image: imageUrl ? [imageUrl] : undefined,
    datePublished: (post.published_at ?? post.created_at) ?? undefined,
    dateModified: post.updated_at ?? undefined,
    author: {
      "@type": "Person",
      name: post.source_name ?? "Nirave Gondhia",
    },
    url: articleUrl,
  };

  const displayOptions = (post as { display_options?: Record<string, unknown> }).display_options ?? {};
  const hideHeader = displayOptions.hide_header === true;

  return (
    <>
      <JsonLd data={newsArticleSchema} />
      <ViewTracker slug={post.slug ?? undefined} />
      <AdminEditShortcut url={`/admin/posts/${post.id}`} />
      <article className={`mx-auto max-w-4xl px-4 pt-8 sm:px-6 lg:px-8 ${isDraftPreview ? "pb-24" : "pb-16"}`}>
      {!hideHeader && (
        <>
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 font-sans text-sm text-gray-400 transition-colors hover:text-hot-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <header className="mb-6">
            <h1 className="font-serif text-5xl font-bold text-hot-white mb-6 md:text-6xl">
              {post.title ?? "Untitled"}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-gray-400">
              <span className="font-sans text-sm text-hot-white/90">Hot Tech</span>
              {date && (
                <span className="font-sans text-sm">
                  {format(new Date(date), "MMM d, yyyy")}
                </span>
              )}
            </div>
          </header>
        </>
      )}

      {post.featured_image && (
        <div className="relative my-12 aspect-video w-full overflow-hidden rounded-xl bg-hot-gray">
          <Image
            src={post.featured_image}
            alt=""
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 896px"
          />
        </div>
      )}

      <PostBody
        html={(post as { content?: string; body?: string }).content || post.body || ""}
        className="prose prose-lg prose-invert mx-auto max-w-2xl max-w-none"
      />
      {(() => {
        const opts = (post as { display_options?: Record<string, unknown> }).display_options;
        const sponsorBlock = opts?.sponsor_block as SponsorBlockData | undefined;
        return (
          sponsorBlock &&
          Array.isArray(sponsorBlock.items) &&
          sponsorBlock.items.length > 0 && (
            <SponsorBlock data={sponsorBlock} />
          )
        );
      })()}
      {post.content_type_slug?.startsWith("showcase_") &&
        Array.isArray(post.showcase_data) &&
        post.showcase_data.length > 0 && (
          <ShowcaseGrid
            type={post.content_type_slug === "showcase_people" ? "people" : "products"}
            items={post.showcase_data as any}
            displayOptions={(post as { display_options?: Record<string, unknown> }).display_options}
          />
        )}
      <SocialEmbedEnhancer />
    </article>
    {isDraftPreview && <PreviewBanner />}
    </>
  );
}
