import Link from "next/link";
import { getProducts } from "@/lib/actions/product";
import { ProductsTable } from "./products-table";

export default async function AdminProductsPage() {
  const products = await getProducts();

  return (
    <div className="flex h-full min-h-0 flex-col p-6 lg:p-10">
      <div className="flex shrink-0 items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-hot-white">
          Products
        </h1>
        <Link
          href="/admin/products/new"
          className="shrink-0 rounded-md bg-hot-white px-4 py-2 font-sans text-sm font-medium text-hot-black transition-colors hover:bg-hot-white/90"
        >
          Add New Product
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-6">
        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full table-fixed border-collapse font-sans">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="w-24 shrink-0 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  Image
                </th>
                <th className="min-w-0 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  Name
                </th>
                <th className="w-32 shrink-0 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  Brand
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
              <ProductsTable products={products} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
