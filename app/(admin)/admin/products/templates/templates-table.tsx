"use client";

import Link from "next/link";
import type { ProductTemplate } from "@/lib/types/product";
import { deleteTemplate } from "@/lib/actions/template";

function TemplateRowActions({ id }: { id: string }) {
  async function handleDelete() {
    if (!window.confirm("Delete this template?")) return;
    await deleteTemplate(id);
    window.location.reload();
  }
  return (
    <div className="flex flex-row items-center justify-end gap-3">
      <Link
        href={`/admin/products/templates/${id}`}
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

type TemplatesTableProps = {
  templates: ProductTemplate[];
};

export function TemplatesTable({ templates }: TemplatesTableProps) {
  if (templates.length === 0) {
    return (
      <tr>
        <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
          No templates yet.{" "}
          <Link
            href="/admin/products/templates/new"
            className="text-hot-white hover:underline"
          >
            Add one
          </Link>
          .
        </td>
      </tr>
    );
  }

  return (
    <>
      {templates.map((template) => (
        <tr
          key={template.id}
          className="border-b border-white/5 transition-colors hover:bg-white/5"
        >
          <td className="min-w-0 px-4 py-3">
            <span className="block truncate font-medium text-hot-white">
              {template.name || "—"}
            </span>
          </td>
          <td className="w-48 shrink-0 px-4 py-3 font-mono text-sm text-gray-400">
            {template.slug || "—"}
          </td>
          <td className="w-24 shrink-0 px-4 py-3 text-gray-400">
            {Array.isArray(template.spec_schema) ? template.spec_schema.length : 0}
          </td>
          <td className="w-24 shrink-0 px-4 py-3 text-gray-400">
            {Array.isArray(template.score_schema) ? template.score_schema.length : 0}
          </td>
          <td className="w-[120px] shrink-0 px-4 py-3 text-right align-middle">
            <TemplateRowActions id={template.id} />
          </td>
        </tr>
      ))}
    </>
  );
}
