import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductById } from "@/lib/actions/product";
import { getTemplates } from "@/lib/actions/template";
import { getCategories } from "@/lib/actions/categories";
import { ProductForm } from "@/components/admin/ProductForm";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  const isNew = id === "new";
  const [product, templates, categories] = await Promise.all([
    isNew ? Promise.resolve(null) : getProductById(id),
    getTemplates(),
    getCategories(),
  ]);

  if (!isNew && !product) {
    notFound();
  }

  return (
    <div className="min-h-screen h-full overflow-y-auto space-y-6 p-6 lg:p-10">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/products"
          className="font-sans text-sm text-gray-400 hover:text-hot-white"
        >
          ← All Products
        </Link>
      </div>
      <h1 className="font-serif text-2xl font-bold text-hot-white">
        {isNew ? "New Product" : "Edit Product"}
      </h1>
      <ProductForm product={product} templates={templates} categories={categories} />
    </div>
  );
}
