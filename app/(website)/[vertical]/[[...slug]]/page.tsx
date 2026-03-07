import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { getTemplateBySlug, getTemplateById } from "@/lib/actions/template";
import { getProductBySlug, getProductsByTemplateId } from "@/lib/actions/product";
import { getAwardById } from "@/lib/actions/award";
import {
  getPostBySlug,
  getPostByPrimaryProductAndType,
  getPostByPrimaryProductAndTypeAnyStatus,
  getPostByIdForPreview,
  getLatestPublishedPosts,
  type SupabasePost,
  type LatestPostItem,
} from "@/lib/data";
import { constructMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { ProductSpecsTable } from "@/components/public/ProductSpecsTable";
import { AwardBadge } from "@/components/public/AwardBadge";
import { ProductCarousel } from "@/components/ui/ProductCarousel";
import { PostBody } from "@/components/posts/PostBody";
import { ViewTracker } from "@/components/analytics/ViewTracker";
import { getBaseUrl } from "@/lib/url";
import { generateProductSchema } from "@/lib/schema/product-jsonld";
import { getSpecsForSchema } from "@/lib/format-specs";
import { getTemplateSchemaAsGroups } from "@/lib/types/template";
import { isPublished, isPreviewMode, getProductForDisplay, getProductBrandName } from "@/lib/content-helpers";
import { getIsAdmin } from "@/lib/auth";
import { getCurrencySymbol } from "@/lib/constants/currencies";

type AffiliateLinkDisplay = { retailer: string; url: string; price_amount?: string; price_currency?: string };

function normalizeAffiliateLinks(links: import("@/lib/types/product").AffiliateLinks | null | undefined): AffiliateLinkDisplay[] {
  if (!links) return [];
  if (Array.isArray(links)) {
    return links
      .filter((item) => item && typeof item === "object" && "retailer" in item && "url" in item)
      .map((item) => {
        const a = item as { retailer: string; url: string; price_amount?: string; price_currency?: string };
        return {
          retailer: String(a.retailer),
          url: String(a.url),
          price_amount: typeof a.price_amount === "string" ? a.price_amount : undefined,
          price_currency: typeof a.price_currency === "string" ? a.price_currency : undefined,
        };
      })
      .filter((x) => x.retailer || x.url);
  }
  return Object.entries(links).map(([retailer, url]) => ({
    retailer,
    url: typeof url === "string" ? url : "",
  }));
}

function getAffiliateButtonLabel(link: AffiliateLinkDisplay): string {
  const amount = link.price_amount?.trim();
  const code = link.price_currency?.trim();
  const symbol = getCurrencySymbol(code);
  const parts: string[] = [];
  if (amount) parts.push(`${symbol}${amount}`);
  if (link.retailer) parts.push(parts.length ? ` at ${link.retailer}` : `Buy at ${link.retailer}`);
  return parts.length ? parts.join("") : `Buy at ${link.retailer || "retailer"}`;
}

function getRetailerButtonClass(retailer: string, isPrimary: boolean): string {
  const r = retailer.toLowerCase();
  if (isPrimary && (r.includes("amazon") || r === "amazon"))
    return "rounded-full px-6 py-3 font-bold bg-amber-500 text-gray-900 hover:bg-amber-400 transition-colors";
  if (isPrimary) return "rounded-full px-6 py-3 font-bold bg-white text-black hover:bg-gray-200 transition-colors";
  return "rounded-full px-4 py-2 text-sm font-medium border border-white/20 bg-white/5 text-hot-white hover:bg-white/10 transition-colors";
}

type PageProps = {
  params: Promise<{ vertical: string; slug?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

/** Level 3: /[vertical]/[productSlug]/review — full editorial review. Uses AnyStatus so admin can see draft/scheduled. */
async function resolveLevel3(vertical: string, productSlug: string) {
  const product = await getProductBySlug(productSlug);
  if (!product) return null;
  const template = product.template_id ? await getTemplateById(product.template_id) : null;
  const post = await getPostByPrimaryProductAndTypeAnyStatus(product.id, "reviews");
  if (!post) return null;
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
      reviewPost: reviewPost && isPublished(reviewPost) ? reviewPost : null,
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
  if (post) return { type: "post" as const, post };
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
      const title = fallback.product.seo_title ?? `${fallback.product.name} | ${getProductBrandName(fallback.product)}`;
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
    const title = r.product.seo_title ?? `${r.product.name} | ${getProductBrandName(r.product)}`;
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

export default async function VerticalPage({ params, searchParams: searchParamsPromise }: PageProps) {
  const { vertical, slug } = await params;
  const slugParts = slug ?? [];
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const searchParams = searchParamsPromise ? await searchParamsPromise : {};
  const isAdmin = await getIsAdmin();
  const showDraft = isAdmin && isPreviewMode(searchParams);

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

        {r.products.filter((p) => isPublished(p)).length > 0 && (
          <ProductCarousel
            products={r.products.filter((p) => isPublished(p)).slice(0, 15)}
            title="Featured"
            linkPrefix={vertical}
            showRating
            className="mb-12"
          />
        )}

        {r.products.filter((p) => isPublished(p)).length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-hot-white mb-4">Devices</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {r.products.filter((p) => isPublished(p)).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/${vertical}/${p.slug ?? p.id}`}
                    className="block rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
                  >
                    <span className="font-medium text-hot-white">{p.name}</span>
                    {getProductBrandName(p) && <span className="text-gray-400 text-sm ml-2">· {getProductBrandName(p)}</span>}
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
        if (!isPublished(fallback.product) && !isAdmin) notFound();
        const product = getProductForDisplay(fallback.product, showDraft);
        const schema = getTemplateSchemaAsGroups(fallback.template?.spec_schema);
        const specsForSchema = schema.length > 0 ? getSpecsForSchema(product.specs, schema) : {};
        const productSchema = generateProductSchema(product, { specsForSchema });
        const imageUrl = product.transparent_image ?? product.hero_image;
        const award = product.award_id ? await getAwardById(product.award_id) : null;
        const glowColor = (product as { primary_color?: string }).primary_color?.trim() || "rgb(59 130 246)";
        const pros = product.editorial_data?.pros ?? [];
        const cons = product.editorial_data?.cons ?? [];
        const productNameDisplay =
          product.name.toLowerCase().startsWith((getProductBrandName(product) || "").toLowerCase())
            ? product.name
            : `${getProductBrandName(product)} ${product.name}`.trim();
        const affiliateLinks = normalizeAffiliateLinks(product.affiliate_links);
        const reviewHrefFallback = `/${vertical}/${product.slug ?? product.id}/review`;

        return (
          <>
            {showDraft && (
              <div className="sticky top-0 left-0 right-0 z-40 border-b border-amber-500/50 bg-amber-500/20 px-4 py-2 text-center font-sans text-sm font-semibold text-amber-200" role="status">
                PREVIEW MODE — DRAFT CONTENT
              </div>
            )}
            <JsonLd data={productSchema} />
            <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
              <Link href="/" className="mb-8 inline-flex items-center gap-1.5 font-sans text-sm text-gray-400 transition-colors hover:text-hot-white">
                <ArrowLeft className="h-4 w-4" /> Back to Home
              </Link>

              <h1 className="font-serif text-4xl md:text-5xl font-bold text-hot-white mb-8">
                {productNameDisplay}
              </h1>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start pt-8 pb-16">
                <div className="lg:col-span-5 sticky top-24">
                  <div className="relative aspect-[3/4] max-h-[480px] rounded-xl border border-white/10 bg-gray-900/50 overflow-hidden">
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        background: `radial-gradient(ellipse 85% 85% at 50% 38%, ${glowColor}, transparent 68%)`,
                      }}
                      aria-hidden
                    />
                    {imageUrl ? (
                      <div className="absolute inset-0 flex items-center justify-center p-6">
                        <Image src={imageUrl} alt={product.name} width={320} height={427} className="relative z-10 w-full h-full object-contain" priority sizes="(max-width: 1024px) 100vw, 50vw" />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="lg:col-span-7">
                  <div className="flex flex-wrap justify-between items-start gap-8">
                    <div className="max-w-[75%]">
                      <div className="inline-block px-3 py-1 bg-white/10 border border-white/10 rounded-full text-xs font-bold tracking-widest uppercase text-gray-300 mb-4">
                        The Verdict
                      </div>
                      {product.editorial_data?.bottom_line && (
                        <p className="text-base md:text-lg text-gray-300 leading-relaxed italic border-l-4 border-white/20 pl-6">
                          {product.editorial_data.bottom_line}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-3 shrink-0">
                      {award && (
                        <div className="w-20 h-20 flex items-center justify-center">
                          <AwardBadge award={award} scale={80 / 240} className="shrink-0" />
                        </div>
                      )}
                      {typeof product.editorial_data?.final_score === "number" && (
                        <div className="w-12 h-12 flex items-center justify-center rounded-full border border-white/30 bg-white/20 text-xl font-bold text-hot-white">
                          {product.editorial_data.final_score}
                        </div>
                      )}
                    </div>
                  </div>

                  {(pros.length > 0 || cons.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
                      {pros.length > 0 && (
                        <div className="rounded-xl border border-green-500/20 bg-green-900/10 p-6">
                          <h3 className="font-sans font-semibold text-green-400 mb-3">Pros</h3>
                          <ul className="space-y-2">
                            {pros.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 font-sans text-sm text-gray-300">
                                <span className="text-green-400 shrink-0 mt-0.5" aria-hidden>+</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {cons.length > 0 && (
                        <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-6">
                          <h3 className="font-sans font-semibold text-red-400 mb-3">Cons</h3>
                          <ul className="space-y-2">
                            {cons.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 font-sans text-sm text-gray-300">
                                <span className="text-red-400 shrink-0 mt-0.5" aria-hidden>−</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 mt-8">
                    <Link
                      href={reviewHrefFallback}
                      className="rounded-full px-6 py-3 bg-white text-black font-bold hover:bg-gray-200 transition-colors"
                    >
                      Read Full Review
                    </Link>
                    {affiliateLinks.map((link, i) => (
                      <a
                        key={link.retailer}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={getRetailerButtonClass(link.retailer, i === 0)}
                      >
                        {getAffiliateButtonLabel(link)}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <ProductSpecsTable product={product} template={fallback.template} className="mb-10" />
            </div>
          </>
        );
      }
      if (fallback.type === "versus") {
        if ((!isPublished(fallback.productA) || !isPublished(fallback.productB)) && !isAdmin) notFound();
        return (
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
            <Link href="/" className="mb-8 inline-flex items-center gap-1.5 font-sans text-sm text-gray-400 transition-colors hover:text-hot-white">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
            <h1 className="font-serif text-4xl font-bold text-hot-white mb-2">{fallback.productA.name} vs {fallback.productB.name}</h1>
            <p className="text-gray-400 font-sans mb-10">Comparison</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              <div>
                <h2 className="text-xl font-semibold text-hot-white mb-4">{getProductBrandName(fallback.productA)} {fallback.productA.name}</h2>
                <ProductSpecsTable product={fallback.productA} template={fallback.templateA} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-hot-white mb-4">{getProductBrandName(fallback.productB)} {fallback.productB.name}</h2>
                <ProductSpecsTable product={fallback.productB} template={fallback.templateB} />
              </div>
            </div>
          </div>
        );
      }
      if (fallback.type === "post") {
        if (!isPublished(fallback.post) && !isAdmin) notFound();
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
    if (!isPublished(r.post) && !isAdmin) notFound();
    const postForDisplay = showDraft ? (await getPostByIdForPreview(r.post.id)) ?? r.post : r.post;
    const articleUrl = `${baseUrl}/${vertical}/${productSlugForReview}/review`;
    const imageUrl = postForDisplay.featured_image?.startsWith("http")
      ? postForDisplay.featured_image
      : postForDisplay.featured_image
        ? `${baseUrl}/${postForDisplay.featured_image.replace(/^\//, "")}`
        : undefined;
    const newsArticleSchema = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: postForDisplay.title ?? "Untitled",
      image: imageUrl ? [imageUrl] : undefined,
      datePublished: postForDisplay.published_at ?? postForDisplay.created_at ?? undefined,
      dateModified: postForDisplay.updated_at ?? undefined,
      author: { "@type": "Person", name: postForDisplay.source_name ?? "Nirave Gondhia" },
      url: articleUrl,
    };
    const date = postForDisplay.updated_at ?? postForDisplay.created_at;
    const postBody = (postForDisplay as { content?: string; body?: string }).content || postForDisplay.body || "";
    return (
      <>
        {showDraft && (
          <div className="sticky top-0 left-0 right-0 z-40 border-b border-amber-500/50 bg-amber-500/20 px-4 py-2 text-center font-sans text-sm font-semibold text-amber-200" role="status">
            PREVIEW MODE — DRAFT CONTENT
          </div>
        )}
        <JsonLd data={newsArticleSchema} />
        <ViewTracker slug={postForDisplay.slug ?? undefined} />
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
              {postForDisplay.title ?? "Untitled"}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-gray-400">
              <span className="font-sans text-sm text-hot-white/90">Hot Tech</span>
              {date && <span className="font-sans text-sm">{format(new Date(date), "MMM d, yyyy")}</span>}
            </div>
          </header>
          {postForDisplay.featured_image && (
            <div className="relative my-12 aspect-video w-full overflow-hidden rounded-xl bg-hot-gray">
              <Image
                src={postForDisplay.featured_image}
                alt=""
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 896px"
              />
            </div>
          )}
          <PostBody html={postBody} className="prose prose-lg prose-invert mx-auto max-w-2xl max-w-none" />
        </article>
      </>
    );
  }

  // Level 2: /[vertical]/[slug]
  const slugPart = slugParts[0];
  const r = await resolveLevel2(vertical, slugPart);
  if (!r) notFound();

  if (r.type === "product") {
    if (!isPublished(r.product) && !isAdmin) notFound();
    const product = getProductForDisplay(r.product, showDraft);
    const schema = getTemplateSchemaAsGroups(r.template?.spec_schema);
    const specsForSchema = schema.length > 0 ? getSpecsForSchema(product.specs, schema) : {};
    const productSchema = generateProductSchema(product, { specsForSchema });
    const imageUrl = product.transparent_image ?? product.hero_image;
    const award = product.award_id ? await getAwardById(product.award_id) : null;
    const glowColor = (product as { primary_color?: string }).primary_color?.trim() || "rgb(59 130 246)";
    const pros = product.editorial_data?.pros ?? [];
    const cons = product.editorial_data?.cons ?? [];
    const productNameDisplay =
      product.name.toLowerCase().startsWith((getProductBrandName(product) || "").toLowerCase())
            ? product.name
        : `${getProductBrandName(product)} ${product.name}`.trim();
    const affiliateLinks = normalizeAffiliateLinks(product.affiliate_links);
    const reviewHref = `/${vertical}/${product.slug ?? product.id}/review`;

    return (
      <>
        {showDraft && (
          <div className="sticky top-0 left-0 right-0 z-40 border-b border-amber-500/50 bg-amber-500/20 px-4 py-2 text-center font-sans text-sm font-semibold text-amber-200" role="status">
            PREVIEW MODE — DRAFT CONTENT
          </div>
        )}
        <JsonLd data={productSchema} />
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <Link
            href={`/${vertical}`}
            className="mb-8 inline-flex items-center gap-1.5 font-sans text-sm text-gray-400 transition-colors hover:text-hot-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {r.template?.name ?? vertical}
          </Link>

          <h1 className="font-serif text-4xl md:text-5xl font-bold text-hot-white mb-8">
            {productNameDisplay}
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start pt-8 pb-16">
            {/* Left: Hardware image + glow */}
            <div className="lg:col-span-5 sticky top-24">
              <div className="relative aspect-[3/4] max-h-[480px] rounded-xl border border-white/10 bg-gray-900/50 overflow-hidden">
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: `radial-gradient(ellipse 85% 85% at 50% 38%, ${glowColor}, transparent 68%)`,
                  }}
                  aria-hidden
                />
                {imageUrl ? (
                  <div className="absolute inset-0 flex items-center justify-center p-6">
                    <Image
                      src={imageUrl}
                      alt={product.name}
                      width={320}
                      height={427}
                      className="relative z-10 w-full h-full object-contain"
                      priority
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {/* Right: Verdict — 80/20 split + pros/cons + action row */}
            <div className="lg:col-span-7">
              <div className="flex flex-wrap justify-between items-start gap-8">
                <div className="max-w-[75%]">
                  <div className="inline-block px-3 py-1 bg-white/10 border border-white/10 rounded-full text-xs font-bold tracking-widest uppercase text-gray-300 mb-4">
                    The Verdict
                  </div>
                  {product.editorial_data?.bottom_line && (
                    <p className="text-base md:text-lg text-gray-300 leading-relaxed italic border-l-4 border-white/20 pl-6">
                      {product.editorial_data.bottom_line}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-center gap-3 shrink-0">
                  {award && (
                    <div className="w-20 h-20 flex items-center justify-center">
                      <AwardBadge award={award} scale={80 / 240} className="shrink-0" />
                    </div>
                  )}
                  {typeof product.editorial_data?.final_score === "number" && (
                    <div className="w-12 h-12 flex items-center justify-center rounded-full border border-white/30 bg-white/20 text-xl font-bold text-hot-white">
                      {product.editorial_data.final_score}
                    </div>
                  )}
                </div>
              </div>

              {(pros.length > 0 || cons.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
                  {pros.length > 0 && (
                    <div className="rounded-xl border border-green-500/20 bg-green-900/10 p-6">
                      <h3 className="font-sans font-semibold text-green-400 mb-3">Pros</h3>
                      <ul className="space-y-2">
                        {pros.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 font-sans text-sm text-gray-300">
                            <span className="text-green-400 shrink-0 mt-0.5" aria-hidden>+</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {cons.length > 0 && (
                    <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-6">
                      <h3 className="font-sans font-semibold text-red-400 mb-3">Cons</h3>
                      <ul className="space-y-2">
                        {cons.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 font-sans text-sm text-gray-300">
                            <span className="text-red-400 shrink-0 mt-0.5" aria-hidden>−</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 mt-8">
                <Link
                  href={reviewHref}
                  className="rounded-full px-6 py-3 bg-white text-black font-bold hover:bg-gray-200 transition-colors"
                >
                  Read Full Review
                </Link>
                {affiliateLinks.map((link, i) => (
                  <a
                    key={link.retailer}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={getRetailerButtonClass(link.retailer, i === 0)}
                  >
                    {getAffiliateButtonLabel(link)}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <ProductSpecsTable product={product} template={r.template} className="mb-10" />
        </div>
      </>
    );
  }

  if (r.type === "versus") {
    if ((!isPublished(r.productA) || !isPublished(r.productB)) && !isAdmin) notFound();
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
            <h2 className="text-xl font-semibold text-hot-white mb-4">{getProductBrandName(r.productA)} {r.productA.name}</h2>
            <ProductSpecsTable product={r.productA} template={r.templateA} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-hot-white mb-4">{getProductBrandName(r.productB)} {r.productB.name}</h2>
            <ProductSpecsTable product={r.productB} template={r.templateB} />
          </div>
        </div>
      </div>
    );
  }

  // r.type === "post" — standard post (redirect or render; we render for same-route consistency)
  if (!isPublished(r.post) && !isAdmin) notFound();
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
