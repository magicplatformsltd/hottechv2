"use client";

import Link from "next/link";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { format, differenceInHours, formatDistanceToNow } from "date-fns";
import type { Product } from "@/lib/types/product";
import { deleteProduct } from "@/lib/actions/product";
import { StatusBadge } from "@/components/admin/StatusBadge";

const awardTierStyles: Record<string, string> = {
  gold: "bg-yellow-900/40 border border-yellow-700/50 text-yellow-300",
  silver: "bg-slate-700/50 border border-slate-600/50 text-slate-200",
  bronze: "bg-orange-950/50 border border-orange-800/50 text-orange-400",
  flat: "bg-emerald-950/50 border border-emerald-800/50 text-emerald-300",
  default: "bg-white/10 border border-white/10 text-gray-300",
};

function ProductRowActions({ id }: { id: string }) {
  async function handleDelete() {
    if (!window.confirm("Delete this product?")) return;
    await deleteProduct(id);
    window.location.reload();
  }
  return (
    <div className="flex flex-row items-center justify-end gap-3">
      <Link
        href={`/admin/products/${id}`}
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

type ProductsTableProps = {
  products: Product[];
};

export function ProductsTable({ products }: ProductsTableProps) {
  if (products.length === 0) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
          No products yet.{" "}
          <Link href="/admin/products/new" className="text-hot-white hover:underline">
            Add one
          </Link>
          .
        </td>
      </tr>
    );
  }

  return (
    <>
      {products.map((product) => (
        <tr
          key={product.id}
          className="border-b border-white/5 transition-colors hover:bg-white/5"
        >
          <td className="w-24 shrink-0 px-4 py-3 align-top">
            {product.hero_image ? (
              <div className="relative h-12 w-12 overflow-hidden rounded-md bg-white/5">
                <Image
                  src={product.hero_image}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white/5 text-xs text-gray-500">
                —
              </div>
            )}
          </td>
          <td className="min-w-0 px-4 py-3 align-top">
            <div>
              <span className="block truncate font-medium text-gray-200">
                {product.name || "—"}
              </span>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                {product.award_id ? (
                  (() => {
                    const award = product.product_awards;
                    const tierKey = award?.tier?.toLowerCase() ?? "default";
                    const tierClasses = awardTierStyles[tierKey] ?? awardTierStyles.default;
                    return (
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 font-medium ${tierClasses}`}
                      >
                        🏆 {award?.name ?? "Award"}
                      </span>
                    );
                  })()
                ) : null}
                <span className="truncate">
                  {product.categories?.name || "Uncategorized"}
                  {(product.product_tags ?? []).map((pt) => pt.tags?.name).filter(Boolean).length > 0
                    ? ` • ${(product.product_tags ?? []).map((pt) => pt.tags?.name).filter(Boolean).join(", ")}`
                    : ""}
                </span>
              </div>
            </div>
          </td>
          <td className="w-32 shrink-0 px-4 py-3 text-sm text-gray-300 align-top">
            {product.brands?.name || "—"}
          </td>
          <td className="w-16 shrink-0 px-4 py-3 text-right align-top">
            {(() => {
              const live = product.editorial_data as { editor_rating?: number; final_score?: number } | undefined;
              const draft = product.draft_data as { editorial_data?: { editor_rating?: number; final_score?: number } } | undefined;
              const score =
                live?.editor_rating ??
                live?.final_score ??
                draft?.editorial_data?.editor_rating ??
                draft?.editorial_data?.final_score;
              if (score != null && typeof score === "number" && !Number.isNaN(score)) {
                return <span className="font-semibold text-gray-200">{score}</span>;
              }
              return <span className="text-gray-500">—</span>;
            })()}
          </td>
          <td className="w-28 shrink-0 px-4 py-3 text-right align-top">
            <StatusBadge status={product.status} publishedAt={product.published_at} />
          </td>
          <td className="w-44 shrink-0 px-4 py-3 align-top text-right">
            <div className="text-gray-400">
              {(product.published_at ?? product.created_at)
                ? format(new Date((product.published_at ?? product.created_at) as string), "MMM d, yy • HH:mm")
                : "—"}
            </div>
            {product.updated_at && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-gray-500">
                <Pencil className="h-3 w-3 shrink-0" />
                {differenceInHours(new Date(), new Date(product.updated_at)) < 48
                  ? formatDistanceToNow(new Date(product.updated_at), { addSuffix: true })
                  : format(new Date(product.updated_at), "MMM d, yy • HH:mm")}
              </p>
            )}
          </td>
          <td className="w-[120px] shrink-0 px-4 py-3 text-right align-top">
            <ProductRowActions id={product.id} />
          </td>
        </tr>
      ))}
    </>
  );
}
