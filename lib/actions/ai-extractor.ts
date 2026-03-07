"use server";

import OpenAI from "openai";
import { fetchUrlAsMarkdown } from "@/lib/ai/fetcher";
import { getTemplateById, getTemplates } from "@/lib/actions/template";
import { getTemplateSchemaAsGroups } from "@/lib/types/template";
import type { SpecGroup, SpecItem } from "@/lib/types/template";
import type {
  ProductSpecsNested,
  VariantMatrixEntry,
  BooleanWithDetails,
  IpRatingEntry,
  CameraLensData,
  DisplayPanelData,
} from "@/lib/types/product";

const EXTRACT_MODEL = "gpt-4o-mini";

const CAMERA_LENS_KEYS =
  "mp, aperture, focalLength, fov, lensType, sensorSize, pixelSize, autofocus, zoom, ois (boolean)";
const DISPLAY_PANEL_KEYS =
  "displayName, diagonalSize, screenToBodyRatio, panelType, colorDepth, resolution, aspectRatio, pixelDensity, refreshRate, pwm, hbmBrightness, peakBrightness, protection, hasDolbyVision (boolean), hasHDR10Plus (boolean), otherFeatures";
const IP_RATING_KEYS = "dust, water (strings; use \"X\" if not rated)";

function buildSchemaDescription(schema: SpecGroup[]): string {
  const lines: string[] = [];
  for (const group of schema) {
    const groupName = group.groupName?.trim() || "General";
    lines.push(`Group: "${groupName}"`);
    for (const spec of group.specs ?? []) {
      const name = spec.name?.trim();
      if (!name) continue;
      const type = (spec as SpecItem).type ?? "text";
      lines.push(`  - ${name} (type: ${type})`);
    }
  }
  return lines.join("\n");
}

function buildTypeInstructions(schema: SpecGroup[]): string {
  const hasNumber = schema.some((g) => (g.specs ?? []).some((s) => (s as SpecItem).type === "number"));
  const hasVariantMatrix = schema.some((g) => (g.specs ?? []).some((s) => (s as SpecItem).type === "variant_matrix"));
  const hasBoolean = schema.some((g) => (g.specs ?? []).some((s) => (s as SpecItem).type === "boolean"));
  const hasCameraLens = schema.some((g) => (g.specs ?? []).some((s) => (s as SpecItem).type === "camera_lens"));
  const hasDisplayPanel = schema.some((g) => (g.specs ?? []).some((s) => (s as SpecItem).type === "display_panel"));
  const hasIpRating = schema.some((g) => (g.specs ?? []).some((s) => (s as SpecItem).type === "ip_rating"));
  const parts: string[] = [];

  parts.push('- For type "text": use a string. Preserve full alphanumeric values (e.g. "Snapdragon 8 Gen 2", "Android 14"). Strip units only when the value is purely numeric (e.g. "5000 mAh" → "5000"). Use empty string if not found.');
  if (hasNumber) {
    parts.push('- For type "number" (e.g. Software Updates): return an integer or a string that contains digits (e.g. 3 or "3 years"); non-digit characters will be stripped during normalization.');
  }
  if (hasVariantMatrix) {
    parts.push(
      '- For type "variant_matrix" (e.g. RAM/Storage, Video Recording): return an array of objects with exactly "value1" and "value2" (strings). Example: [{"value1":"8 GB","value2":"128 GB"}]. For Video Recording, always split the string at the "@" or "at" symbol: put the Resolution (e.g. "4K", "1080p") in value1 and the Framerate (e.g. "30fps", "60fps") in value2. Example: "4K@30fps" or "4K at 30fps" → [{"value1":"4K","value2":"30fps"}]'
    );
  }
  if (hasBoolean) {
    parts.push('- For type "boolean" (Yes/No toggle): return a strict boolean true or false, or an object {"value": true|false, "details": ""}. Normalize "Yes"/"No" to true/false.');
  }
  if (hasCameraLens) {
    parts.push(
      `- For type "camera_lens" (structured form): return a single object with these exact JSON keys: ${CAMERA_LENS_KEYS}. Use empty strings for missing values; ois is boolean. Do not return a flat string.`
    );
  }
  if (hasDisplayPanel) {
    parts.push(
      `- For type "display_panel" (structured form): return a single object with these exact JSON keys: ${DISPLAY_PANEL_KEYS}. Use empty strings for missing values; hasDolbyVision and hasHDR10Plus are booleans. Do not return a flat string. When populating the "panelType" (Panel type) field, exclude any information already captured in specific fields like "refreshRate", "resolution", or brightness fields (e.g. "hbmBrightness", "peakBrightness"). Keep "panelType" strictly to the technology used (e.g. "LTPO AMOLED", "IPS LCD").`
    );
  }
  if (hasIpRating) {
    parts.push(
      `- For type "ip_rating": return an array of objects with keys ${IP_RATING_KEYS}. Example: [{"dust":"6","water":"8"}]. Use "X" if not rated.`
    );
  }
  return parts.join("\n");
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) return null;
  return new OpenAI({ apiKey: apiKey.trim() });
}

/** AI-extracted product identity; required so we avoid "Unknown" / "Imported Product" fallbacks. */
export type ExtractedProductIdentity = { brand: string; modelName: string };

/**
 * Extract product spec data and identity from a technical product URL using the given template (Blueprint).
 * Fetches the page as Markdown via Jina, then uses OpenAI to fill the template's spec_schema and a required identity object.
 * Returns specs, identity (brand + modelName), or error.
 */
export async function extractProductData(
  url: string,
  templateId: string
): Promise<{
  specs: ProductSpecsNested | null;
  identity: ExtractedProductIdentity | null;
  error?: string;
  statusCode?: number;
}> {
  const u = (url ?? "").trim();
  const tid = (templateId ?? "").trim();
  if (!u || !tid) {
    return { specs: null, error: "url and templateId are required." };
  }

  const [fetchResult, template] = await Promise.all([
    fetchUrlAsMarkdown(u),
    getTemplateById(tid),
  ]);

  const markdown = fetchResult.markdown;
  const isHtml = fetchResult.isHtml === true;
  if (!markdown) {
    const message =
      fetchResult.statusCode != null
        ? `Jina returned ${fetchResult.statusCode}. Check the URL or try again.`
        : "Could not fetch URL as Markdown. Check the URL or try again.";
    return { specs: null, identity: null, error: message, statusCode: fetchResult.statusCode };
  }
  if (!template) {
    return { specs: null, identity: null, error: "Template not found." };
  }

  const schema = getTemplateSchemaAsGroups(template.spec_schema);
  if (schema.length === 0) {
    return { specs: null, identity: null, error: "Template has no spec schema." };
  }

  const client = getOpenAIClient();
  if (!client) {
    return { specs: null, error: "OPENAI_API_KEY is not set." };
  }

  const schemaDesc = buildSchemaDescription(schema);
  const typeInstructions = buildTypeInstructions(schema);
  const inputInstruction = isHtml
    ? "The input may be raw HTML. Discard all UI elements, ads, and navigation, and focus only on the technical specification tables. "
    : "";
  const systemPrompt = `You extract technical product specifications and product identity from page content (e.g. from GSMArena, manufacturer pages). ${inputInstruction}

Output a single JSON object with this structure:
1. "identity" (required): an object with exactly two string fields:
   - "brand": The manufacturer or brand name (e.g. "Nothing", "Samsung", "Apple").
   - "modelName": The full marketing / product name (e.g. "Phone (2a)", "Galaxy S24 Ultra", "iPhone 15 Pro").
2. All other top-level keys must be the exact group names from the schema. Each value is an object whose keys are the exact spec names from the schema.

Rules:
- identity.brand and identity.modelName are required; infer them clearly from the page (title, headings, spec tables).
- Only include groups and specs from the schema.

Type-specific rules (follow exactly):
${typeInstructions}`;

  const contentLabel = isHtml
    ? "Page content (raw HTML; focus on spec tables only):"
    : "Markdown content from the product page:";
  const userContent = `Schema to fill (use these exact group and spec names):
${schemaDesc}

${contentLabel}
---
${markdown.slice(0, 120000)}
---

Return only valid JSON (no markdown code fence).`;

  try {
    const completion = await client.chat.completions.create({
      model: EXTRACT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { specs: null, identity: null, error: "Empty response from AI." };

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const identityRaw = parsed.identity;
    const brand =
      identityRaw && typeof identityRaw === "object" && "brand" in identityRaw && typeof (identityRaw as { brand?: unknown }).brand === "string"
        ? String((identityRaw as { brand: string }).brand).trim()
        : "";
    const modelName =
      identityRaw && typeof identityRaw === "object" && "modelName" in identityRaw && typeof (identityRaw as { modelName?: unknown }).modelName === "string"
        ? String((identityRaw as { modelName: string }).modelName).trim()
        : "";
    const identity: ExtractedProductIdentity | null =
      brand && modelName ? { brand, modelName } : null;
    if (!identity) {
      return { specs: null, identity: null, error: "AI response missing required identity.brand or identity.modelName." };
    }

    const specs: ProductSpecsNested = {};
    for (const group of schema) {
      const groupName = group.groupName?.trim() || "General";
      if (groupName === "identity") continue;
      const fromAi = parsed[groupName] as Record<string, unknown> | undefined;
      if (!fromAi || typeof fromAi !== "object") {
        specs[groupName] = {};
        continue;
      }
      const groupOut: Record<
        string,
        string | VariantMatrixEntry[] | BooleanWithDetails | IpRatingEntry[] | CameraLensData | DisplayPanelData
      > = {};
      for (const spec of group.specs ?? []) {
        const specName = spec.name?.trim();
        if (!specName) continue;
        const type = (spec as SpecItem).type ?? "text";
        const val = fromAi[specName];
        if (val === undefined || val === null) continue;
        if (type === "variant_matrix" && Array.isArray(val)) {
          groupOut[specName] = (val as { value1?: string; value2?: string }[]).map((x) => ({
            value1: String(x?.value1 ?? "").trim(),
            value2: String(x?.value2 ?? "").trim(),
          }));
        } else if (type === "boolean") {
          if (typeof val === "boolean") {
            groupOut[specName] = { value: val, details: "" };
          } else if (val && typeof val === "object" && "value" in val) {
            const v = val as { value?: boolean; details?: string };
            groupOut[specName] = { value: Boolean(v.value), details: String(v.details ?? "").trim() };
          } else {
            groupOut[specName] = { value: String(val).toLowerCase() === "yes" || String(val).toLowerCase() === "true", details: "" };
          }
        } else if (type === "ip_rating" && Array.isArray(val)) {
          groupOut[specName] = (val as { dust?: string; water?: string }[]).map((x) => ({
            dust: String(x?.dust ?? "X").trim(),
            water: String(x?.water ?? "X").trim(),
          }));
        } else if (type === "camera_lens" && val && typeof val === "object" && !Array.isArray(val)) {
          const o = val as Record<string, unknown>;
          groupOut[specName] = {
            mp: String(o.mp ?? "").trim(),
            aperture: String(o.aperture ?? "").trim(),
            focalLength: String(o.focalLength ?? "").trim(),
            fov: String(o.fov ?? "").trim(),
            lensType: String(o.lensType ?? "").trim(),
            sensorSize: String(o.sensorSize ?? "").trim(),
            pixelSize: String(o.pixelSize ?? "").trim(),
            autofocus: String(o.autofocus ?? "").trim(),
            zoom: String(o.zoom ?? "").trim(),
            ois: Boolean(o.ois),
          } as CameraLensData;
        } else if (type === "display_panel" && val && typeof val === "object" && !Array.isArray(val)) {
          const o = val as Record<string, unknown>;
          groupOut[specName] = {
            displayName: String(o.displayName ?? "").trim(),
            diagonalSize: String(o.diagonalSize ?? "").trim(),
            screenToBodyRatio: String(o.screenToBodyRatio ?? "").trim(),
            panelType: String(o.panelType ?? "").trim(),
            colorDepth: String(o.colorDepth ?? "").trim(),
            resolution: String(o.resolution ?? "").trim(),
            aspectRatio: String(o.aspectRatio ?? "").trim(),
            pixelDensity: String(o.pixelDensity ?? "").trim(),
            refreshRate: String(o.refreshRate ?? "").trim(),
            pwm: String(o.pwm ?? "").trim(),
            hbmBrightness: String(o.hbmBrightness ?? "").trim(),
            peakBrightness: String(o.peakBrightness ?? "").trim(),
            protection: String(o.protection ?? "").trim(),
            hasDolbyVision: Boolean(o.hasDolbyVision),
            hasHDR10Plus: Boolean(o.hasHDR10Plus),
            otherFeatures: String(o.otherFeatures ?? "").trim(),
          } as DisplayPanelData;
        } else {
          groupOut[specName] = typeof val === "string" ? val : typeof val === "number" ? String(val) : String(val);
        }
      }
      specs[groupName] = groupOut;
    }
    return { specs, identity };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[extractProductData]", message);
    return { specs: null, identity: null, error: message };
  }
}

/**
 * Ask the AI to pick the best-matching product template (e.g. Smartphone, Tablet, Laptop)
 * from the page content. Use when the user has not yet selected a Blueprint.
 */
export async function detectTemplateFromUrl(
  url: string,
  markdown: string
): Promise<{ templateId: string | null; templateName: string | null; error?: string }> {
  const u = (url ?? "").trim();
  const md = (markdown ?? "").trim();
  if (!u || !md) {
    return { templateId: null, templateName: null, error: "url and markdown are required." };
  }

  const [templates, client] = await Promise.all([getTemplates(), Promise.resolve(getOpenAIClient())]);
  if (!client) return { templateId: null, templateName: null, error: "OPENAI_API_KEY is not set." };
  if (templates.length === 0) return { templateId: null, templateName: null, error: "No templates in database." };

  const namesAndIds = templates.map((t) => ({ name: t.name, id: t.id })).filter((t) => t.name && t.id);
  const list = namesAndIds.map((n) => `${n.name} (id: ${n.id})`).join("\n");

  const systemPrompt = `You identify the type of product from a technical product page. Choose the single best-matching template from the provided list. Return JSON only: { "templateId": "<uuid>", "templateName": "<name>" }. Use the exact templateId UUID from the list.`;

  const userContent = `Available templates (use exact templateId):
${list}

Page content (first 8000 chars):
---
${md.slice(0, 8000)}
---

Which template best matches this product? Return JSON with templateId and templateName.`;

  try {
    const completion = await client.chat.completions.create({
      model: EXTRACT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { templateId: null, templateName: null, error: "Empty response." };

    const parsed = JSON.parse(raw) as { templateId?: string; templateName?: string };
    const templateId = parsed.templateId && namesAndIds.some((t) => t.id === parsed.templateId) ? parsed.templateId : null;
    const templateName = parsed.templateName ?? null;
    return { templateId, templateName };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[detectTemplateFromUrl]", message);
    return { templateId: null, templateName: null, error: message };
  }
}
