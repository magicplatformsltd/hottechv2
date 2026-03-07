import { notFound } from "next/navigation";
import Link from "next/link";
import { getAwardById } from "@/lib/actions/award";
import { AwardForm } from "@/components/admin/AwardForm";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminAwardDetailPage({ params }: PageProps) {
  const { id } = await params;
  const isNew = id === "new";
  const award = isNew ? null : await getAwardById(id);

  if (!isNew && !award) {
    notFound();
  }

  return (
    <div className="min-h-screen h-full overflow-y-auto space-y-6 p-6 lg:p-10">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/products/awards"
          className="font-sans text-sm text-gray-400 hover:text-hot-white"
        >
          ← All Awards
        </Link>
      </div>
      <h1 className="font-serif text-2xl font-bold text-hot-white">
        {isNew ? "New Award" : "Edit Award"}
      </h1>
      <AwardForm award={award} />
    </div>
  );
}
