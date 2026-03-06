import Link from "next/link";
import { getPosts } from "./actions";
import { PostsTable } from "./posts-table";
import { PostsSearchBar } from "./posts-search-bar";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function AdminPostsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q ?? "";
  const posts = await getPosts(query || undefined);

  return (
    <div className="flex h-full min-h-0 flex-col p-6 lg:p-10">
      <div className="flex shrink-0 items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-hot-white">
          All Posts
        </h1>
        <div className="flex items-center gap-4">
          <PostsSearchBar />
          <Link
            href="/admin/posts/new"
            className="shrink-0 rounded-md bg-hot-white px-4 py-2 font-sans text-sm font-medium text-hot-black transition-colors hover:bg-hot-white/90"
          >
            Add New
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-6">
        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full table-fixed border-collapse font-sans">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="w-auto min-w-0 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                Content
              </th>
              <th className="w-28 shrink-0 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                Status
              </th>
              <th className="w-44 shrink-0 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                Timeline
              </th>
              <th className="w-[120px] shrink-0 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <PostsTable posts={posts} searchQuery={query} />
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
