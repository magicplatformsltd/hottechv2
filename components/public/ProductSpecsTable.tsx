import type { Product, ProductTemplate } from "@/lib/types/product";
import { getTemplateSchemaAsGroups } from "@/lib/types/template";
import { getSpecGroupsForTable } from "@/lib/format-specs";

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate || typeof isoDate !== "string") return "";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type ProductSpecsTableProps = {
  product: Product;
  template: ProductTemplate | null;
  className?: string;
};

/**
 * Renders the product spec table (power-table) for hubs and versus pages.
 * Responsive: multi-column grid on desktop, single column on mobile.
 */
export function ProductSpecsTable({ product, template, className = "" }: ProductSpecsTableProps) {
  const schema = getTemplateSchemaAsGroups(template?.spec_schema);
  const groups = getSpecGroupsForTable(product.specs, schema);

  const hasDates =
    product.announcement_date ||
    product.release_date ||
    product.discontinued_date ||
    product.software_updates_years != null ||
    product.security_updates_years != null;

  return (
    <div className={`w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 ${className}`}>
      {groups.length === 0 && !hasDates ? (
        <div className="p-4 text-sm text-gray-500">No spec schema. Assign a template to this product.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
          {groups.map((g) => (
            <div key={g.groupName} className="border-b border-r border-white/5 last:border-r-0">
              <div className="bg-white/10 p-3 font-bold text-sm uppercase tracking-wider text-gray-200 dark:text-gray-300">
                {g.groupName}
              </div>
              <div className="divide-y divide-white/5">
                {g.rows.map((row) => (
                  <div key={row.rowLabel} className="flex border-white/5">
                    <div className="w-1/3 shrink-0 font-medium text-gray-400 p-3 text-sm capitalize">
                      {row.rowLabel}
                    </div>
                    <div
                      className={`w-2/3 text-gray-900 dark:text-white p-3 text-sm ${row.isDisplayPanel ? "whitespace-pre-line" : ""}`}
                    >
                      {row.display}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {hasDates && (
            <div className="border-b border-r border-white/5 md:col-span-2 lg:col-span-1 last:border-r-0">
              <div className="bg-white/10 p-3 font-bold text-sm uppercase tracking-wider text-gray-200 dark:text-gray-300">
                Key dates &amp; support
              </div>
              <div className="divide-y divide-white/5">
                {product.announcement_date && (
                  <div className="flex">
                    <div className="w-1/3 shrink-0 font-medium text-gray-400 p-3 text-sm">Announced</div>
                    <div className="w-2/3 text-gray-900 dark:text-white p-3 text-sm">
                      {formatDate(product.announcement_date)}
                    </div>
                  </div>
                )}
                {product.release_date && (
                  <div className="flex">
                    <div className="w-1/3 shrink-0 font-medium text-gray-400 p-3 text-sm">Released</div>
                    <div className="w-2/3 text-gray-900 dark:text-white p-3 text-sm">
                      {formatDate(product.release_date)}
                    </div>
                  </div>
                )}
                {product.discontinued_date && (
                  <div className="flex">
                    <div className="w-1/3 shrink-0 font-medium text-gray-400 p-3 text-sm">Discontinued</div>
                    <div className="w-2/3 text-gray-900 dark:text-white p-3 text-sm">
                      {formatDate(product.discontinued_date)}
                    </div>
                  </div>
                )}
                {product.software_updates_years != null && (
                  <div className="flex">
                    <div className="w-1/3 shrink-0 font-medium text-gray-400 p-3 text-sm">Software updates</div>
                    <div className="w-2/3 text-gray-900 dark:text-white p-3 text-sm">
                      {product.software_updates_years} years
                    </div>
                  </div>
                )}
                {product.security_updates_years != null && (
                  <div className="flex">
                    <div className="w-1/3 shrink-0 font-medium text-gray-400 p-3 text-sm">Security updates</div>
                    <div className="w-2/3 text-gray-900 dark:text-white p-3 text-sm">
                      {product.security_updates_years} years
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
