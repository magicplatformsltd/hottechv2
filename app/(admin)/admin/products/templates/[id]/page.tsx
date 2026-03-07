import { notFound } from "next/navigation";
import Link from "next/link";
import { getTemplateById } from "@/lib/actions/template";
import { TemplateForm } from "@/components/admin/TemplateForm";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminTemplateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const isNew = id === "new";
  const template = isNew ? null : await getTemplateById(id);

  if (!isNew && !template) {
    notFound();
  }

  return (
    <div className="min-h-screen h-full overflow-y-auto space-y-6 p-6 lg:p-10">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/products/templates"
          className="font-sans text-sm text-gray-400 hover:text-hot-white"
        >
          ← All Templates
        </Link>
      </div>
      <h1 className="font-serif text-2xl font-bold text-hot-white">
        {isNew ? "New Template" : "Edit Template"}
      </h1>
      <TemplateForm template={template} />
    </div>
  );
}
