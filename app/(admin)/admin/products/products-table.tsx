"use client";

import Link from "next/link";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { format, differenceInHours, formatDistanceToNow } from "date-fns";
import type { Product } from "@/lib/types/product";
import { deleteProduct } from "@/lib/actions/product";
import { StatusBadge } from "@/components/admin/StatusBadge";

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
        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
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
            <span className="block truncate font-medium text-hot-white">
              {product.name || "—"}
            </span>
          </td>
          <td className="w-32 shrink-0 px-4 py-3 text-gray-400 align-top">
            {product.brands?.name ?? "—"}
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
