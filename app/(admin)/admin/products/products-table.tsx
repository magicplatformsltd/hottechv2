"use client";

import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/types/product";
import { deleteProduct } from "@/lib/actions/product";
import { format, parseISO } from "date-fns";

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
        <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
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
          <td className="w-24 shrink-0 px-4 py-3 align-middle">
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
          <td className="min-w-0 px-4 py-3">
            <span className="block truncate font-medium text-hot-white">
              {product.name || "—"}
            </span>
          </td>
          <td className="w-32 shrink-0 px-4 py-3 text-gray-400">
            {product.brand || "—"}
          </td>
          <td className="w-36 shrink-0 px-4 py-3 text-gray-400">
            {product.release_date
              ? (() => {
                  try {
                    return format(parseISO(product.release_date), "MMM d, yyyy");
                  } catch {
                    return product.release_date;
                  }
                })()
              : "—"}
          </td>
          <td className="w-[120px] shrink-0 px-4 py-3 text-right align-middle">
            <ProductRowActions id={product.id} />
          </td>
        </tr>
      ))}
    </>
  );
}
