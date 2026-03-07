import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { getTemplateBySlug, getTemplateById } from "@/lib/actions/template";
import { getProductBySlug, getProductsByTemplateId } from "@/lib/actions/product";
import {
  getPostBySlug,
  getPostByPrimaryProductAndType,
  getLatestPublishedPosts,
  type SupabasePost,
  type LatestPostItem,
} from "@/lib/data";
import { constructMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { ProductSpecsTable } from "@/components/public/ProductSpecsTable";
import { PostBody } from "@/components/posts/PostBody";
import { ViewTracker } from "@/components/analytics/ViewTracker";
import { getBaseUrl } from "@/lib/url";
import { generateProductSchema } from "@/lib/schema/product-jsonld";
import { getSpecsForSchema } from "@/lib/format-specs";
import { getTemplateSchemaAsGroups } from "@/lib/types/template";

type PageProps = {
  params: Promise<{ vertical: string; slug?: string[] }>;
};

function isPublishedPost(post: SupabasePost): boolean {
  if (post.status !== "published") return false;
  if (post.published_at && new Date(post.published_at) > new Date()) return false;
  return true;
}

/** Level 1: Category Hub — valid template slug, no slug segments */
async function resolveLevel1(vertical: string) {
  const template = await getTemplateBySlug(vertical);
  console.log("[Unified Resolver] resolveLevel1", { vertical, templateFound: !!template, templateId: template?.id });
  if (!template) return null;
  const [products, latestPosts] = await Promise.all([
    getProductsByTemplateId(template.id),
    getLatestPublishedPosts(8),
  ]);
  return { type: "category" as const, template, products, latestPosts };
}

/** Level 3: /[vertical]/[productSlug]/review — full editorial review */
async function resolveLevel3(vertical: string, productSlug: string) {
  const product = await getProductBySlug(productSlug);
  if (!product) return null;
  const template = product.template_id ? await getTemplateById(product.template_id) : null;
  const post = await getPostByPrimaryProductAndType(product.id, "reviews");
  if (!post || !isPublishedPost(post)) return null;
  return { type: "review" as const, product, template, post };
}

/** Level 2: Product Hub, Versus, or Standard Post. Priority: Product > Versus > Post */
async function resolveLevel2(vertical: string, slugPart: string) {
  const product = await getProductBySlug(slugPart);
  if (product) {
    const template = product.template_id ? await getTemplateById(product.template_id) : null;
    const reviewPost = await getPostByPrimaryProductAndType(product.id, "reviews");
    return {
      type: "product" as const,
      product,
      template,
      reviewPost: reviewPost && isPublishedPost(reviewPost) ? reviewPost : null,
    };
  }

  if (slugPart.includes("-vs-")) {
    const [slugA, slugB] = slugPart.split("-vs-").map((s) => s.trim()).filter(Boolean);
    if (slugA && slugB) {
      const [productA, productB] = await Promise.all([
        getProductBySlug(slugA),
        getProductBySlug(slugB),
      ]);
      if (productA && productB) {
        const [templateA, templateB] = await Promise.all([
          productA.template_id ? getTemplateById(productA.template_id) : null,
          productB.template_id ? getTemplateById(productB.template_id) : null,
        ]);
        return {
          type: "versus" as const,
          productA,
          productB,
          templateA,
          templateB,
        };
      }
    }
  }

  const post = await getPostBySlug(slugPart);
  if (post && isPublishedPost(post)) {
    return { type: "post" as const, post };
  }
  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { vertical, slug } = await params;
  const slugParts = slug ?? [];

  if (slugParts.length === 0) {
    const r = await resolveLevel1(vertical);
    if (r) {
      return await constructMetadata({
        title: `${r.template.name} | Hot Tech`,
        description: `Browse ${r.template.name} and latest news.`,
        type: "website",
      });
    }
    // Fallback: vertical is not a template → try as product/post for metadata
    const fallback = await resolveLevel2(vertical, vertical);
    if (fallback?.type === "product") {
      const title = fallback.product.seo_title ?? `${fallback.product.name} | ${fallback.product.brand}`;
      const description = fallback.product.seo_description ?? fallback.product.editorial_data?.bottom_line ?? undefined;
      return await constructMetadata({ title, description, image: fallback.product.hero_image ?? fallback.product.transparent_image ?? undefined, type: "website", canonical: `/${vertical}` });
    }
    if (fallback?.type === "post") {
      return await constructMetadata({
        title: fallback.post.title ?? "Untitled",
        description: fallback.post.excerpt ?? undefined,
        image: fallback.post.featured_image ?? undefined,
        type: "article",
        canonical: `/${vertical}`,
      });
    }
    if (fallback?.type === "versus") {
      return await constructMetadata({ title: `${fallback.productA.name} vs ${fallback.productB.name} | Hot Tech`, type: "website", canonical: `/${vertical}` });
    }
    return {};
  }

  const isReviewMeta =
    (slugParts.length === 2 && slugParts[1] === "review") ||
    (slugParts.length === 1 && slugParts[0] === "review");
  const productSlugMeta = slugParts.length === 2 ? slugParts[0] : slugParts[0] === "review" ? vertical : null;
  if (isReviewMeta && productSlugMeta) {
    const r = await resolveLevel3(vertical, productSlugMeta);
    if (!r) return {};
    return await constructMetadata({
      title: r.post.title ?? `${r.product.name} Review`,
      description: r.post.excerpt ?? undefined,
      image: r.post.featured_image ?? undefined,
      type: "article",
      canonical: `/${vertical}/${productSlugMeta}/review`,
    });
  }

  const r = await resolveLevel2(vertical, slugParts[0]);
  if (!r) return {};
  if (r.type === "product") {
    const title = r.product.seo_title ?? `${r.product.name} | ${r.product.brand}`;
    const description = r.product.seo_description ?? r.product.editorial_data?.bottom_line ?? undefined;
    return await constructMetadata({
      title,
      description,
      image: r.product.hero_image ?? r.product.transparent_image ?? undefined,
      type: "website",
      canonical: `/${vertical}/${slugParts[0]}`,
    });
  }
  if (r.type === "versus") {
    const title = `${r.productA.name} vs ${r.productB.name} | Hot Tech`;
    return await constructMetadata({ title, type: "website", canonical: `/${vertical}/${slugParts[0]}` });
  }
  if (r.type === "post") {
    return await constructMetadata({
      title: r.post.title ?? "Untitled",
      description: r.post.excerpt ?? undefined,
      image: r.post.featured_image ?? undefined,
      type: "article",
      canonical: `/${vertical}/${slugParts[0]}`,
    });
  }
  return {};
}

export default async function VerticalPage({ params }: PageProps) {
  const { vertical, slug } = await params;
  const slugParts = slug ?? [];
  const baseUrl = getBaseUrl().replace(/\/$/, "");

  // Resolver logs (STEP 105 – remove after debugging)
  console.log("[Unified Resolver]", { vertical, slug, slugParts, segmentCount: slugParts.length });

  // Level 1: /[vertical] — category hub, or fallback to Level 2 (single segment = product/post/versus)
  if (slugParts.length === 0) {
    const r = await resolveLevel1(vertical);
    if (r) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 font-sans text-sm text-gray-400 transition-colors hover:text-hot-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <h1 className="font-serif text-4xl font-bold text-hot-white mb-2">{r.template.name}</h1>
        <p className="text-gray-400 font-sans text-lg mb-10">Browse devices and latest news.</p>

        {r.products.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-hot-white mb-4">Devices</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {r.products.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/${vertical}/${p.slug ?? p.id}`}
                    className="block rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
                  >
                    <span className="font-medium text-hot-white">{p.name}</span>
                    {p.brand && <span className="text-gray-400 text-sm ml-2">· {p.brand}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="text-xl font-semibold text-hot-white mb-4">Latest News &amp; Reviews</h2>
          {r.latestPosts.length === 0 ? (
            <p className="text-gray-500">More content coming soon.</p>
          ) : (
            <ul className="space-y-3">
              {r.latestPosts.map((post) => (
                <li key={post.id}>
                  <Link
                    href={post.slug ? `/${vertical}/${post.slug}` : `/#${post.id}`}
                    className="text-hot-white hover:underline font-sans"
                  >
                    {post.title ?? "Untitled"}
                  </Link>
                  {post.published_at && (
                    <span className="text-gray-500 text-sm ml-2">
                      {format(new Date(post.published_at), "MMM d, yyyy")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
    }
    // Fallback: vertical is not a template slug → try as product/post/versus (fixes collision with [slug] route)
    const fallback = await resolveLevel2(vertical, vertical);
    if (fallback) {
      if (fallback.type === "product") {
        const schema = getTemplateSchemaAsGroups(fallback.template?.spec_schema);
        const specsForSchema = schema.length > 0 ? getSpecsForSchema(fallback.product.specs, schema) : {};
        const productSchema = generateProductSchema(fallback.product, { specsForSchema });
        const imageUrl = fallback.product.transparent_image ?? fallback.product.hero_image;
        return (
          <>
            <JsonLd data={productSchema} />
            <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
              <Link href="/" className="mb-8 inline-flex items-center gap-1.5 font-sans text-sm text-gray-400 transition-colors hover:text-hot-white">
                <ArrowLeft className="h-4 w-4" /> Back to Home
              </Link>
              <header className="mb-8">
                <h1 className="font-serif text-4xl md:text-5xl font-bold text-hot-white mb-2">
                  {fallback.product.brand} {fallback.product.name}
                </h1>
                {typeof fallback.product.editorial_data?.final_score === "number" && (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm font-medium text-amber-200">
                    Editor&apos;s Rating: {fallback.product.editorial_data.final_score}/10
                  </div>
                )}
              </header>
              {imageUrl && (
                <div className="relative aspect-square max-w-sm mx-auto mb-10">
                  <Image src={imageUrl} alt={fallback.product.name} fill className="object-contain" priority sizes="384px" />
                </div>
              )}
              <ProductSpecsTable product={fallback.product} template={fallback.template} className="mb-10" />
              {fallback.reviewPost && (
                <section className="mt-10">
                  <h2 className="text-xl font-semibold text-hot-white mb-4">Full Review</h2>
                  <Link href={`/${vertical}/review`} className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-hot-white hover:bg-white/10">
                    Read Full Editorial Review
                  </Link>
                </section>
              )}
            </div>
          </>
        );
      }
      if (fallback.type === "versus") {
        return (
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
            <Link href="/" className="mb-8 inline-flex items-center gap-1.5 font-sans text-sm text-gray-400 transition-colors hover:text-hot-white">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
            <h1 className="font-serif text-4xl font-bold text-hot-white mb-2">{fallback.productA.name} vs {fallback.productB.name}</h1>
            <p className="text-gray-400 font-sans mb-10">Comparison</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              <div>
                <h2 className="text-xl font-semibold text-hot-white mb-4">{fallback.productA.brand} {fallback.productA.name}</h2>
                <ProductSpecsTable product={fallback.productA} template={fallback.templateA} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-hot-white mb-4">{fallback.productB.brand} {fallback.productB.name}</h2>
                <ProductSpecsTable product={fallback.productB} template={fallback.templateB} />
              </div>
            </div>
          </div>
        );
      }
      if (fallback.type === "post") {
        const post = fallback.post;
        const articleUrl = post.slug ? `${baseUrl}/${vertical}/${post.slug}` : baseUrl;
        const imageUrl = post.featured_image?.startsWith("http") ? post.featured_image : post.featured_image ? `${baseUrl}/${post.featured_image.replace(/^\//, "")}` : undefined;
        const newsArticleSchema = {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: post.title ?? "Untitled",
          image: imageUrl ? [imageUrl] : undefined,
          datePublished: post.published_at ?? post.created_at ?? undefined,
          dateModified: post.updated_at ?? undefined,
          author: { "@type": "Person", name: post.source_name ?? "Nirave Gondhia" },
          url: articleUrl,
        };
        const date = post.updated_at ?? post.created_at;
        return (
          <>
            <JsonLd data={newsArticleSchema} />
            <ViewTracker slug={post.slug ?? undefined} />
            <article className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 lg:px-8 pb-16">
              <Link href="/" className="mb-8 inline-flex items-center gap-1.5 font-sans text-sm text-gray-400 transition-colors hover:text-hot-white">
                <ArrowLeft className="h-4 w-4" /> Back to Home
              </Link>
              <header className="mb-6">
                <h1 className="font-serif text-5xl font-bold text-hot-white mb-6 md:text-6xl">{post.title ?? "Untitled"}</h1>
                <div className="flex flex-wrap items-center gap-3 text-gray-400">
                  <span className="font-sans text-sm text-hot-white/90">Hot Tech</span>
                  {date && <span className="font-sans text-sm">{format(new Date(date), "MMM d, yyyy")}</span>}
                </div>
              </header>
              {post.featured_image && (
                <div className="relative my-12 aspect-video w-full overflow-hidden rounded-xl bg-hot-gray">
                  <Image src={post.featured_image} alt="" fill className="object-cover" priority sizes="(max-width: 768px) 100vw, 896px" />
                </div>
              )}
              <PostBody html={(post as { content?: string; body?: string }).content || post.body || ""} className="prose prose-lg prose-invert mx-auto max-w-2xl max-w-none" />
            </article>
          </>
        );
      }
    }
    notFound();
  }

  // Level 3: /[vertical]/[productSlug]/review or /[productSlug]/review (after middleware redirect from [slug]-review)
  const isReviewPath =
    (slugParts.length === 2 && slugParts[1] === "review") ||
    (slugParts.length === 1 && slugParts[0] === "review");
  const productSlugForReview = slugParts.length === 2 ? slugParts[0] : slugParts[0] === "review" ? vertical : null;

  if (isReviewPath && productSlugForReview) {
    const r = await resolveLevel3(vertical, productSlugForReview);
    if (!r) notFound();
    const articleUrl = `${baseUrl}/${vertical}/${productSlugForReview}/review`;
    const imageUrl = r.post.featured_image?.startsWith("http")
      ? r.post.featured_image
      : r.post.featured_image
        ? `${baseUrl}/${r.post.featured_image.replace(/^\//, "")}`
        : undefined;
    const newsArticleSchema = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: r.post.title ?? "Untitled",
      image: imageUrl ? [imageUrl] : undefined,
      datePublished: r.post.published_at ?? r.post.created_at ?? undefined,
      dateModified: r.post.updated_at ?? undefined,
      author: { "@type": "Person", name: r.post.source_name ?? "Nirave Gondhia" },
      url: articleUrl,
    };
    const date = r.post.updated_at ?? r.post.created_at;
    return (
      <>
        <JsonLd data={newsArticleSchema} />
        <ViewTracker slug={r.post.slug ?? undefined} />
        <article className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 lg:px-8 pb-16">
          <Link
            href={`/${vertical}/${productSlugForReview}`}
            className="mb-8 inline-flex items-center gap-1.5 font-sans text-sm text-gray-400 transition-colors hover:text-hot-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {r.product.name}
          </Link>
          <header className="mb-6">
            <h1 className="font-serif text-5xl font-bold text-hot-white mb-6 md:text-6xl">
              {r.post.title ?? "Untitled"}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-gray-400">
              <span className="font-sans text-sm text-hot-white/90">Hot Tech</span>
              {date && <span className="font-sans text-sm">{format(new Date(date), "MMM d, yyyy")}</span>}
            </div>
          </header>
          {r.post.featured_image && (
            <div className="relative my-12 aspect-video w-full overflow-hidden rounded-xl bg-hot-gray">
              <Image
                src={r.post.featured_image}
                alt=""
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 896px"
              />
            </div>
          )}
          <PostBody
            html={(r.post as { content?: string; body?: string }).content || r.post.body || ""}
            className="prose prose-lg prose-invert mx-auto max-w-2xl max-w-none"
          />
        </article>
      </>
    );
  }

  // Level 2: /[vertical]/[slug]
  const slugPart = slugParts[0];
  const r = await resolveLevel2(vertical, slugPart);
  if (!r) notFound();

  if (r.type === "product") {
    const schema = getTemplateSchemaAsGroups(r.template?.spec_schema);
    const specsForSchema = schema.length > 0 ? getSpecsForSchema(r.product.specs, schema) : {};
    const productSchema = generateProductSchema(r.product, { specsForSchema });
    const imageUrl = r.product.transparent_image ?? r.product.hero_image;
    return (
      <>
        <JsonLd data={productSchema} />
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <Link
            href={`/${vertical}`}
            className="mb-8 inline-flex items-center gap-1.5 font-sans text-sm text-gray-400 transition-colors hover:text-hot-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {r.template?.name ?? vertical}
          </Link>
          <header className="mb-8">
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-hot-white mb-2">
              {r.product.brand} {r.product.name}
            </h1>
            {typeof r.product.editorial_data?.final_score === "number" && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm font-medium text-amber-200">
                Editor&apos;s Rating: {r.product.editorial_data.final_score}/10
              </div>
            )}
          </header>
          {imageUrl && (
            <div className="relative aspect-square max-w-sm mx-auto mb-10">
              <Image
                src={imageUrl}
                alt={r.product.name}
                fill
                className="object-contain"
                priority
                sizes="384px"
              />
            </div>
          )}
          <ProductSpecsTable product={r.product} template={r.template} className="mb-10" />
          {r.reviewPost && (
            <section className="mt-10">
              <h2 className="text-xl font-semibold text-hot-white mb-4">Full Review</h2>
              <Link
                href={`/${vertical}/${slugPart}/review`}
                className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-hot-white hover:bg-white/10"
              >
                Read Full Editorial Review
              </Link>
            </section>
          )}
        </div>
      </>
    );
  }

  if (r.type === "versus") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href={`/${vertical}`}
          className="mb-8 inline-flex items-center gap-1.5 font-sans text-sm text-gray-400 transition-colors hover:text-hot-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {vertical}
        </Link>
        <h1 className="font-serif text-4xl font-bold text-hot-white mb-2">
          {r.productA.name} vs {r.productB.name}
        </h1>
        <p className="text-gray-400 font-sans mb-10">Comparison</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <div>
            <h2 className="text-xl font-semibold text-hot-white mb-4">{r.productA.brand} {r.productA.name}</h2>
            <ProductSpecsTable product={r.productA} template={r.templateA} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-hot-white mb-4">{r.productB.brand} {r.productB.name}</h2>
            <ProductSpecsTable product={r.productB} template={r.templateB} />
          </div>
        </div>
      </div>
    );
  }

  // r.type === "post" — standard post (redirect or render; we render for same-route consistency)
  const post = r.post;
  const articleUrl = post.slug ? `${baseUrl}/${vertical}/${post.slug}` : baseUrl;
  const imageUrl = post.featured_image?.startsWith("http")
    ? post.featured_image
    : post.featured_image
      ? `${baseUrl}/${post.featured_image.replace(/^\//, "")}`
      : undefined;
  const newsArticleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title ?? "Untitled",
    image: imageUrl ? [imageUrl] : undefined,
    datePublished: post.published_at ?? post.created_at ?? undefined,
    dateModified: post.updated_at ?? undefined,
    author: { "@type": "Person", name: post.source_name ?? "Nirave Gondhia" },
    url: articleUrl,
  };
  const date = post.updated_at ?? post.created_at;
  return (
    <>
      <JsonLd data={newsArticleSchema} />
      <ViewTracker slug={post.slug ?? undefined} />
      <article className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 lg:px-8 pb-16">
        <Link
          href={`/${vertical}`}
          className="mb-8 inline-flex items-center gap-1.5 font-sans text-sm text-gray-400 transition-colors hover:text-hot-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {vertical}
        </Link>
        <header className="mb-6">
          <h1 className="font-serif text-5xl font-bold text-hot-white mb-6 md:text-6xl">
            {post.title ?? "Untitled"}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-gray-400">
            <span className="font-sans text-sm text-hot-white/90">Hot Tech</span>
            {date && <span className="font-sans text-sm">{format(new Date(date), "MMM d, yyyy")}</span>}
          </div>
        </header>
        {post.featured_image && (
          <div className="relative my-12 aspect-video w-full overflow-hidden rounded-xl bg-hot-gray">
            <Image src={post.featured_image} alt="" fill className="object-cover" priority sizes="(max-width: 768px) 100vw, 896px" />
          </div>
        )}
        <PostBody
          html={(post as { content?: string; body?: string }).content || post.body || ""}
          className="prose prose-lg prose-invert mx-auto max-w-2xl max-w-none"
        />
      </article>
    </>
  );
}
