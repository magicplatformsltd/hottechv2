"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { format, differenceInHours, formatDistanceToNow } from "date-fns";
import type { PostRow } from "./actions";
import { deletePost } from "./actions";

function PostRowActions({ id }: { id: string }) {
  async function handleDelete() {
    if (!window.confirm("Delete this post?")) return;
    await deletePost(id);
    window.location.reload();
  }
  return (
    <div className="flex flex-row items-center justify-end gap-3">
      <Link
        href={`/admin/posts/${id}`}
        className="text-sm text-hot-white/80 hover:text-hot-white"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        className="cursor-pointer text-sm text-red-400 hover:text-red-300"
      >
        Delete
      </button>
    </div>
  );
}

export function PostsTable({ posts }: { posts: PostRow[] }) {
  if (posts.length === 0) {
    return (
      <tr>
        <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
          No posts yet.{" "}
          <Link href="/admin/posts/new" className="text-hot-white hover:underline">
            Add one
          </Link>
          .
        </td>
      </tr>
    );
  }

  return (
    <>
      {posts.map((post) => (
        <tr
          key={post.id}
          className="border-b border-white/5 transition-colors hover:bg-white/5"
        >
          <td className="w-full max-w-0 px-4 py-3 align-top">
            <Link
              href={`/admin/posts/${post.id}`}
              className="block truncate font-medium text-hot-white hover:underline"
              title={post.title || "Untitled"}
            >
              {post.title || "Untitled"}
            </Link>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 truncate text-sm text-gray-400">
              {post.source_name?.trim() && (
                <span className="mr-2 inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {post.source_name.trim()}
                </span>
              )}
              {(() => {
                const cats = (post.category_names ?? []).join(", ");
                const tags = (post.tag_names ?? []).join(", ");
                if (cats && tags) return `${cats} | ${tags}`;
                if (cats) return cats;
                if (tags) return tags;
                return "—";
              })()}
            </p>
          </td>
          <td className="w-28 shrink-0 px-4 py-3 text-right align-top">
            <span
              className={
                post.status === "published" &&
                post.published_at &&
                new Date(post.published_at) > new Date()
                  ? "rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400"
                  : post.status === "published"
                    ? "rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400"
                    : "rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400"
              }
            >
              {post.status === "published" &&
              post.published_at &&
              new Date(post.published_at) > new Date()
                ? "Scheduled"
                : post.status === "published"
                  ? "Published"
                  : "Draft"}
            </span>
          </td>
          <td className="w-44 shrink-0 px-4 py-3 align-top text-right">
            <div className="text-gray-400">
              {(post.published_at ?? post.created_at)
                ? format(new Date((post.published_at ?? post.created_at) as string), "MMM d, yy • HH:mm")
                : "—"}
            </div>
            {post.updated_at && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-gray-500">
                <Pencil className="h-3 w-3 shrink-0" />
                {differenceInHours(new Date(), new Date(post.updated_at)) < 48
                  ? formatDistanceToNow(new Date(post.updated_at), { addSuffix: true })
                  : format(new Date(post.updated_at), "MMM d, yy • HH:mm")}
              </p>
            )}
          </td>
          <td className="w-[120px] shrink-0 px-4 py-3 text-right align-top">
            <PostRowActions id={post.id} />
          </td>
        </tr>
      ))}
    </>
  );
}
