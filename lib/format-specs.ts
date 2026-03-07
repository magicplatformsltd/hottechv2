/**
 * Shared spec formatting for ProductSpecsTable and ProductReviewCard.
 * Converts raw spec values to display strings (variant_matrix, ip_rating, camera_lens, etc.).
 */

import type { ProductSpecsInput } from "@/lib/types/product";
import { getRawSpecValue } from "@/lib/types/product";
import type {
  VariantMatrixEntry,
  IpRatingEntry,
  BooleanWithDetails,
  CameraLensData,
  DisplayPanelData,
} from "@/lib/types/product";
import type { SpecGroup, SpecItem } from "@/lib/types/template";

export function formatVariantMatrixForDisplay(
  arr: VariantMatrixEntry[],
  spec: SpecItem
): string {
  const hideLabels = spec.matrixConfig?.hideLabelsPublicly === true;
  const label1 = hideLabels ? "" : (spec.matrixConfig?.col1Label ?? "");
  const label2 = hideLabels ? "" : (spec.matrixConfig?.col2Label ?? "");
  return arr
    .map((item) => {
      const v1 = (item.value1 ?? "").trim();
      const v2 = (item.value2 ?? "").trim();
      if (hideLabels) return v1 && v2 ? `${v1} / ${v2}` : v1 || v2;
      if (v1 && v2) return `${v1} ${label1} / ${v2} ${label2}`.trim();
      if (v1) return `${v1} ${label1}`.trim();
      return `${v2} ${label2}`.trim();
    })
    .filter(Boolean)
    .join(", ");
}

export function formatBooleanWithDetails(obj: BooleanWithDetails): string {
  if (obj.value === false) return "No";
  const d = (obj.details ?? "").trim();
  return d ? `Yes (${d})` : "Yes";
}

export function formatCameraLensForDisplay(item: CameraLensData): string {
  const focalAndType =
    (item.focalLength ?? "").trim() && (item.lensType ?? "").trim()
      ? `${(item.focalLength ?? "").trim()} (${(item.lensType ?? "").trim()})`
      : (item.focalLength ?? "").trim() || (item.lensType ?? "").trim();
  const parts = [
    (item.mp ?? "").trim(),
    (item.aperture ?? "").trim(),
    focalAndType,
    (item.fov ?? "").trim(),
    (item.sensorSize ?? "").trim(),
    (item.pixelSize ?? "").trim(),
    (item.autofocus ?? "").trim(),
    (item.zoom ?? "").trim(),
  ].filter(Boolean);
  if (item.ois === true) parts.push("OIS");
  return parts.join(", ") || "";
}

export function formatDisplayPanelForDisplay(item: DisplayPanelData): string {
  const formatUnit = (val: string | undefined, unit: string) => {
    if (!val) return "";
    const lowerVal = val.toLowerCase();
    const lowerUnit = unit.toLowerCase().trim();
    if (lowerVal.includes(lowerUnit)) return val;
    return `${val}${unit}`;
  };
  const sizeVal = formatUnit((item.diagonalSize ?? "").trim(), " inches");
  const resVal = formatUnit((item.resolution ?? "").trim(), " pixels");
  const densityVal = (item.pixelDensity ?? "").trim()
    ? `~${formatUnit((item.pixelDensity ?? "").trim(), " ppi")} density`
    : "";
  const refreshVal = (item.refreshRate ?? "").trim()
    ? `${formatUnit((item.refreshRate ?? "").trim(), "Hz")} Refresh Rate`
    : "";
  const pwmVal = (item.pwm ?? "").trim() ? `${formatUnit((item.pwm ?? "").trim(), "Hz")} PWM` : "";
  const hbmVal = (item.hbmBrightness ?? "").trim()
    ? `${formatUnit((item.hbmBrightness ?? "").trim(), " nits")} (HBM)`
    : "";
  const peakVal = (item.peakBrightness ?? "").trim()
    ? `${formatUnit((item.peakBrightness ?? "").trim(), " nits")} (Peak)`
    : "";
  const typeParts = [(item.panelType ?? "").trim(), (item.colorDepth ?? "").trim()].filter(Boolean);
  const lineType = typeParts.length > 0 ? `Type: ${typeParts.join(", ")}` : "";
  const sizeParts = [
    sizeVal,
    (item.screenToBodyRatio ?? "").trim() ? `(~${(item.screenToBodyRatio ?? "").trim()} screen-to-body ratio)` : "",
  ].filter(Boolean);
  const lineSize = sizeParts.length > 0 ? `Size: ${sizeParts.join(" ")}` : "";
  const resParts = [
    resVal,
    (item.aspectRatio ?? "").trim() ? `${(item.aspectRatio ?? "").trim()} ratio` : "",
    densityVal,
  ].filter(Boolean);
  const lineRes = resParts.length > 0 ? `Resolution: ${resParts.join(", ")}` : "";
  const lineRatings = [refreshVal, pwmVal].filter(Boolean).length > 0 ? `Display Ratings: ${[refreshVal, pwmVal].filter(Boolean).join(", ")}` : "";
  const lineBright = [hbmVal, peakVal].filter(Boolean).length > 0 ? `Brightness: ${[hbmVal, peakVal].filter(Boolean).join(" / ")}` : "";
  const featParts = [
    item.hasDolbyVision ? "Dolby Vision" : "",
    item.hasHDR10Plus ? "HDR10+" : "",
    (item.otherFeatures ?? "").trim(),
  ].filter(Boolean);
  const lineFeat = featParts.length > 0 ? `Features: ${featParts.join(", ")}` : "";
  const lineProt = (item.protection ?? "").trim() ? `Protection: ${(item.protection ?? "").trim()}` : "";
  return [lineType, lineSize, lineRes, lineRatings, lineBright, lineFeat, lineProt].filter(Boolean).join("\n");
}

export function formatIpRatingForDisplay(arr: IpRatingEntry[]): string {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  const onlyXX = arr.every((p) => (p.dust ?? "X") === "X" && (p.water ?? "X") === "X");
  if (onlyXX) return "Not officially rated";
  return arr.map((pair) => `IP${pair.dust ?? "X"}${pair.water ?? "X"}`).join(" / ");
}

export type SpecTableRow = { rowLabel: string; display: string; isDisplayPanel: boolean };
export type SpecTableGroup = { groupName: string; rows: SpecTableRow[] };

/** Build grouped spec rows for ProductSpecsTable. Uses getRawSpecValue and formatters above. */
export function getSpecGroupsForTable(
  productSpecs: ProductSpecsInput | null | undefined,
  templateSchema: SpecGroup[]
): SpecTableGroup[] {
  const out: SpecTableGroup[] = [];
  for (const group of templateSchema) {
    const groupName = group.groupName?.trim() || "General";
    const rows: SpecTableRow[] = [];
    for (const spec of group.specs ?? []) {
      const specName = spec.name?.trim() ?? "";
      const rawValue = getRawSpecValue(productSpecs, groupName, specName);
      let display: string;
      let isDisplayPanel = false;
      if (typeof rawValue === "string") {
        display = rawValue.trim();
      } else if (Array.isArray(rawValue) && rawValue.length > 0 && rawValue[0] != null && "dust" in rawValue[0] && "water" in rawValue[0]) {
        display = formatIpRatingForDisplay(rawValue as IpRatingEntry[]);
      } else if (Array.isArray(rawValue)) {
        display = formatVariantMatrixForDisplay(rawValue as VariantMatrixEntry[], spec);
      } else if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && "value" in rawValue) {
        display = formatBooleanWithDetails(rawValue as BooleanWithDetails);
      } else if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && "mp" in rawValue && "ois" in rawValue) {
        display = formatCameraLensForDisplay(rawValue as CameraLensData);
      } else if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && "hasDolbyVision" in rawValue && "hasHDR10Plus" in rawValue) {
        display = formatDisplayPanelForDisplay(rawValue as DisplayPanelData);
        isDisplayPanel = true;
      } else {
        continue;
      }
      if (!display) continue;
      let rowLabel = specName.replace(/_/g, " ");
      if (rawValue && typeof rawValue === "object" && "displayName" in rawValue && (rawValue as { displayName?: string }).displayName) {
        rowLabel = String((rawValue as { displayName: string }).displayName).trim();
      }
      rows.push({ rowLabel, display, isDisplayPanel });
    }
    if (rows.length > 0) out.push({ groupName, rows });
  }
  return out;
}

/** Flat spec name -> display value for JSON-LD additionalProperty. */
export function getSpecsForSchema(
  productSpecs: ProductSpecsInput | null | undefined,
  templateSchema: SpecGroup[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const group of templateSchema) {
    const groupName = group.groupName?.trim() || "General";
    for (const spec of group.specs ?? []) {
      const specName = spec.name?.trim() ?? "";
      const rawValue = getRawSpecValue(productSpecs, groupName, specName);
      let display: string;
      if (typeof rawValue === "string") display = rawValue.trim();
      else if (Array.isArray(rawValue) && rawValue.length > 0 && rawValue[0] != null && "dust" in rawValue[0] && "water" in rawValue[0])
        display = formatIpRatingForDisplay(rawValue as IpRatingEntry[]);
      else if (Array.isArray(rawValue)) display = formatVariantMatrixForDisplay(rawValue as VariantMatrixEntry[], spec);
      else if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && "value" in rawValue)
        display = formatBooleanWithDetails(rawValue as BooleanWithDetails);
      else if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && "mp" in rawValue && "ois" in rawValue)
        display = formatCameraLensForDisplay(rawValue as CameraLensData);
      else if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && "hasDolbyVision" in rawValue && "hasHDR10Plus" in rawValue)
        display = formatDisplayPanelForDisplay(rawValue as DisplayPanelData);
      else display = "";
      if (!display) continue;
      let rowLabel = specName.replace(/_/g, " ");
      if (rawValue && typeof rawValue === "object" && "displayName" in rawValue && (rawValue as { displayName?: string }).displayName)
        rowLabel = String((rawValue as { displayName: string }).displayName).trim();
      out[rowLabel] = display;
    }
  }
  return out;
}
