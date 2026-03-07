import Link from "next/link";
import { getAwards } from "@/lib/actions/award";
import { AwardsTable } from "./awards-table";

export default async function AdminAwardsPage() {
  const awards = await getAwards();

  return (
    <div className="min-h-screen h-full overflow-y-auto space-y-6 p-6 lg:p-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/products"
            className="font-sans text-sm text-gray-400 hover:text-hot-white"
          >
            ← Products
          </Link>
          <h1 className="font-serif text-2xl font-bold text-hot-white">
            Product Awards
          </h1>
        </div>
        <Link
          href="/admin/products/awards/new"
          className="rounded-md bg-hot-white px-4 py-2 font-sans text-sm font-medium text-hot-black hover:bg-hot-white/90"
        >
          Add Award
        </Link>
      </div>
      <AwardsTable awards={awards} />
    </div>
  );
}
