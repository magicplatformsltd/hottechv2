"use client";

import Link from "next/link";
import type { ProductAwardRecord } from "@/lib/types/award";
import { deleteAward } from "@/lib/actions/award";

function AwardRowActions({ id }: { id: string }) {
  async function handleDelete() {
    if (!window.confirm("Delete this award? Products using it will have no award.")) return;
    await deleteAward(id);
    window.location.reload();
  }
  return (
    <div className="flex items-center justify-end gap-3">
      <Link
        href={`/admin/products/awards/${id}`}
        className="text-sm text-hot-white/80 hover:text-hot-white"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        className="text-sm text-red-400 hover:text-red-300"
      >
        Delete
      </button>
    </div>
  );
}

type AwardsTableProps = {
  awards: ProductAwardRecord[];
};

export function AwardsTable({ awards }: AwardsTableProps) {
  if (awards.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-8 text-center text-gray-400">
        No awards yet.{" "}
        <Link href="/admin/products/awards/new" className="text-hot-white hover:underline">
          Add one
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <table className="w-full min-w-0 table-fixed">
        <thead>
          <tr className="border-b border-white/10 text-left">
            <th className="px-4 py-3 font-sans text-sm font-medium text-gray-400">Name</th>
            <th className="w-48 shrink-0 px-4 py-3 font-sans text-sm font-medium text-gray-400">Slug</th>
            <th className="w-24 shrink-0 px-4 py-3 font-sans text-sm font-medium text-gray-400">Icon</th>
            <th className="w-[120px] shrink-0 px-4 py-3 text-right font-sans text-sm font-medium text-gray-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {awards.map((award) => (
            <tr
              key={award.id}
              className="border-b border-white/5 transition-colors hover:bg-white/5"
            >
              <td className="min-w-0 px-4 py-3">
                <span className="block truncate font-medium text-hot-white">
                  {award.name || "—"}
                </span>
              </td>
              <td className="w-48 shrink-0 px-4 py-3 font-mono text-sm text-gray-400">
                {award.slug || "—"}
              </td>
              <td className="w-24 shrink-0 px-4 py-3 text-gray-400">
                {award.icon || "Award"}
              </td>
              <td className="w-[120px] shrink-0 px-4 py-3 text-right align-middle">
                <AwardRowActions id={award.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
