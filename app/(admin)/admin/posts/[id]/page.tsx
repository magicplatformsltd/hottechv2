import { notFound } from "next/navigation";
import Link from "next/link";
import { getPostById, getPostTaxonomies } from "../actions";
import { getCategories } from "@/lib/actions/categories";
import { getTags } from "@/lib/actions/tags";
import { getContentTypes } from "@/lib/actions/content-types";
import { getSiteSettings } from "@/lib/data";
import { EditPostForm } from "../edit-post-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPostPage({ params }: PageProps) {
  const { id } = await params;
  const [post, taxonomies, categories, tags, contentTypes, settings] = await Promise.all([
    getPostById(id),
    getPostTaxonomies(id),
    getCategories(),
    getTags(),
    getContentTypes(),
    getSiteSettings(),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen h-full overflow-y-auto space-y-6 p-6 lg:p-10">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/posts"
          className="font-sans text-sm text-gray-400 hover:text-hot-white"
        >
          ← All Posts
        </Link>
      </div>
      <h1 className="font-serif text-2xl font-bold text-hot-white">
        Edit Post
      </h1>
      <EditPostForm
        post={post}
        categories={categories}
        tags={tags}
        contentTypes={contentTypes}
        initialCategoryIds={taxonomies.categoryIds}
        initialTagIds={taxonomies.tagIds}
        initialContentTypeId={taxonomies.contentTypeId}
        siteTimezone={settings?.timezone}
      />
    </div>
  );
}
