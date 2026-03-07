import type { Product, ProductTemplate } from "@/lib/types/product";
import { getTemplateSchemaAsGroups } from "@/lib/types/template";
import { getSpecGroupsForTable } from "@/lib/format-specs";

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate || typeof isoDate !== "string") return "";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Parse multi-line "Label: value" strings (e.g. Display/Camera) into sub-rows. Splits at first colon only to preserve ratios like 19.5:9. */
function parseComplexValue(
  value: unknown
): { subLabel: string; subValue: string }[] | null {
  if (typeof value !== "string" || !value.includes("\n") || !value.includes(":"))
    return null;
  const lines = value.split("\n").map((l) => l.trim()).filter(Boolean);
  const parsed: { subLabel: string; subValue: string }[] = [];
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx >= 0) {
      parsed.push({
        subLabel: line.slice(0, idx).trim(),
        subValue: line.slice(idx + 1).trim(),
      });
    }
  }
  return parsed.length > 0 ? parsed : null;
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
        <div className="flex flex-col w-full">
          {groups.map((g) => (
            <div key={g.groupName}>
              <div className="bg-white/5 border-y border-white/10 px-4 py-3 text-sm font-bold uppercase tracking-wider text-hot-white mt-8 first:mt-0">
                {g.groupName}
              </div>
              {g.rows.map((row) => {
                const complex = parseComplexValue(row.display);
                if (complex && complex.length > 0) {
                  return (
                    <div key={row.rowLabel} className="contents">
                      <div className="col-span-1 md:col-span-12 px-4 py-2 bg-white/[0.03] border-b border-white/5 text-xs font-bold text-gray-300 uppercase tracking-wider">
                        {row.rowLabel}
                      </div>
                      {complex.map((item, i) => (
                        <div
                          key={`${row.rowLabel}-${i}-${item.subLabel}`}
                          className="grid grid-cols-1 md:grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="md:col-span-3 text-sm text-gray-400 font-medium pl-4">
                            {item.subLabel}
                          </div>
                          <div className="md:col-span-9 text-sm text-gray-200 leading-relaxed">
                            {item.subValue}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                return (
                  <div
                    key={row.rowLabel}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="md:col-span-3 text-sm text-gray-400 font-medium capitalize">
                      {row.rowLabel}
                    </div>
                    <div
                      className={`md:col-span-9 text-sm text-gray-200 dark:text-gray-200 leading-relaxed ${row.isDisplayPanel || (typeof row.display === "string" && row.display.includes("\n")) ? "whitespace-pre-line" : ""}`}
                    >
                      {row.display}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {hasDates && (
            <div className="mt-8">
              <div className="bg-white/5 border-y border-white/10 px-4 py-3 text-sm font-bold uppercase tracking-wider text-hot-white">
                Key dates &amp; support
              </div>
              {product.announcement_date && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <div className="md:col-span-3 text-sm text-gray-400 font-medium">Announced</div>
                  <div className="md:col-span-9 text-sm text-gray-200 leading-relaxed">
                    {formatDate(product.announcement_date)}
                  </div>
                </div>
              )}
              {product.release_date && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <div className="md:col-span-3 text-sm text-gray-400 font-medium">Released</div>
                  <div className="md:col-span-9 text-sm text-gray-200 leading-relaxed">
                    {formatDate(product.release_date)}
                  </div>
                </div>
              )}
              {product.discontinued_date && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <div className="md:col-span-3 text-sm text-gray-400 font-medium">Discontinued</div>
                  <div className="md:col-span-9 text-sm text-gray-200 leading-relaxed">
                    {formatDate(product.discontinued_date)}
                  </div>
                </div>
              )}
              {product.software_updates_years != null && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <div className="md:col-span-3 text-sm text-gray-400 font-medium">Software updates</div>
                  <div className="md:col-span-9 text-sm text-gray-200 leading-relaxed">
                    {product.software_updates_years} years
                  </div>
                </div>
              )}
              {product.security_updates_years != null && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <div className="md:col-span-3 text-sm text-gray-400 font-medium">Security updates</div>
                  <div className="md:col-span-9 text-sm text-gray-200 leading-relaxed">
                    {product.security_updates_years} years
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
