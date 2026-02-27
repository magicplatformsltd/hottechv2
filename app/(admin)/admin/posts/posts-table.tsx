"use client";

import Link from "next/link";
import { format } from "date-fns";
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
        <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
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
          <td className="min-w-0 px-4 py-3">
            <Link
              href={`/admin/posts/${post.id}`}
              className="block truncate font-medium text-hot-white hover:underline"
              title={post.title || "Untitled"}
            >
              {post.title || "Untitled"}
            </Link>
          </td>
          <td className="w-40 shrink-0 px-4 py-3 text-sm text-gray-400">
            {(post.category_names ?? []).length > 0
              ? (post.category_names ?? []).slice(0, 2).join(", ")
              : "—"}
          </td>
          <td className="w-32 shrink-0 px-4 py-3 text-right">
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
          <td className="w-48 shrink-0 px-4 py-3 text-right text-gray-400">
            {post.created_at
              ? format(new Date(post.created_at), "MMM d, yyyy • HH:mm")
              : "—"}
          </td>
          <td className="w-[120px] shrink-0 px-4 py-3 text-right">
            <PostRowActions id={post.id} />
          </td>
        </tr>
      ))}
    </>
  );
}
