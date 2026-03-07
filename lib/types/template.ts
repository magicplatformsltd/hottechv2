/**
 * Template spec schema: grouped architecture for spec labels and key-spec marking.
 */

export type SpecItemType = "text" | "variant_matrix" | "boolean" | "camera_lens" | "display_panel" | "ip_rating";

export interface SpecItem {
  id: string;
  name: string;
  isKey: boolean;
  /** Default 'text' when undefined (backward compatibility). */
  type?: SpecItemType;
  /** For variant_matrix: custom column labels and optional hide-labels on front-end. */
  matrixConfig?: { col1Label: string; col2Label: string; hideLabelsPublicly?: boolean };
}

export interface SpecGroup {
  id: string;
  groupName: string;
  specs: SpecItem[];
}

/** Flatten spec_schema (SpecGroup[] or legacy string[]) to an array of spec names. */
export function getSpecLabelsFromSchema(spec_schema: SpecGroup[] | string[] | undefined): string[] {
  if (!Array.isArray(spec_schema) || spec_schema.length === 0) return [];
  const first = spec_schema[0];
  if (typeof first === "string") return spec_schema.filter((s): s is string => typeof s === "string" && String(s).trim() !== "");
  if (typeof first === "object" && first !== null && "specs" in first) {
    return (spec_schema as SpecGroup[]).flatMap((g) => (g.specs ?? []).map((s) => s.name).filter(Boolean));
  }
  return [];
}

/** Return template spec_schema as SpecGroup[] (convert legacy string[] to one "General" group). */
export function getTemplateSchemaAsGroups(spec_schema: SpecGroup[] | string[] | undefined): SpecGroup[] {
  if (!Array.isArray(spec_schema) || spec_schema.length === 0) return [];
  const first = spec_schema[0];
  if (typeof first === "string") {
    const labels = (spec_schema as string[]).filter((s) => typeof s === "string" && String(s).trim() !== "");
    if (labels.length === 0) return [];
    return [
      {
        id: "general",
        groupName: "General",
        specs: labels.map((name) => ({ id: name, name: String(name).trim(), isKey: false })),
      },
    ];
  }
  if (typeof first === "object" && first !== null && "groupName" in first && "specs" in first) {
    return spec_schema as SpecGroup[];
  }
  return [];
}
