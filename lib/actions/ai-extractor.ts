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
} from "@/lib/types/product";

const EXTRACT_MODEL = "gpt-4o-mini";

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

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) return null;
  return new OpenAI({ apiKey: apiKey.trim() });
}

/**
 * Extract product spec data from a technical product URL using the given template (Blueprint).
 * Fetches the page as Markdown via Jina, then uses OpenAI to fill the template's spec_schema.
 * Returns a nested object matching ProductSpecsNested (groupName -> specName -> value).
 */
export async function extractProductData(
  url: string,
  templateId: string
): Promise<{ specs: ProductSpecsNested | null; error?: string; statusCode?: number }> {
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
    return { specs: null, error: message, statusCode: fetchResult.statusCode };
  }
  if (!template) {
    return { specs: null, error: "Template not found." };
  }

  const schema = getTemplateSchemaAsGroups(template.spec_schema);
  if (schema.length === 0) {
    return { specs: null, error: "Template has no spec schema." };
  }

  const client = getOpenAIClient();
  if (!client) {
    return { specs: null, error: "OPENAI_API_KEY is not set." };
  }

  const schemaDesc = buildSchemaDescription(schema);
  const inputInstruction = isHtml
    ? "The input may be raw HTML. Discard all UI elements, ads, and navigation, and focus only on the technical specification tables. "
    : "";
  const systemPrompt = `You extract technical product specifications from page content (e.g. from GSMArena, manufacturer pages). ${inputInstruction}

Rules:
- Output a single JSON object. Top-level keys must be the exact group names from the schema. Each value is an object whose keys are the exact spec names from the schema.
- For type "text": use a string. Strip units from numbers (e.g. "5000 mAh" → "5000", "6.1 inches" → "6.1"). Keep units only when the spec is explicitly a unit (e.g. "kg" for weight). Use empty string if not found.
- For type "variant_matrix": use an array of objects with "value1" and "value2" (strings). Example: [{"value1":"8GB","value2":"128GB"}].
- For type "boolean": use {"value": true|false, "details": ""}. Set details only if the source gives extra context.
- For type "ip_rating": use an array of {"dust": "6", "water": "8"} (single digit strings). Use "X" if not rated.
- For type "camera_lens" or "display_panel": use a single string that summarizes the key specs, or leave empty if not extractable.
- Only include groups and specs that appear in the schema. Omit any spec you cannot find (or use empty string / empty array).
- Normalize boolean-like phrases: "Yes", "No", "Supported" → true/false.`;

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
    if (!raw) return { specs: null, error: "Empty response from AI." };

    const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    const specs: ProductSpecsNested = {};
    for (const group of schema) {
      const groupName = group.groupName?.trim() || "General";
      const fromAi = parsed[groupName];
      if (!fromAi || typeof fromAi !== "object") {
        specs[groupName] = {};
        continue;
      }
      const groupOut: Record<string, string | VariantMatrixEntry[] | BooleanWithDetails | IpRatingEntry[]> = {};
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
        } else if (type === "boolean" && val && typeof val === "object" && "value" in val) {
          const v = val as { value?: boolean; details?: string };
          groupOut[specName] = { value: Boolean(v.value), details: String(v.details ?? "").trim() };
        } else if (type === "ip_rating" && Array.isArray(val)) {
          groupOut[specName] = (val as { dust?: string; water?: string }[]).map((x) => ({
            dust: String(x?.dust ?? "X").trim(),
            water: String(x?.water ?? "X").trim(),
          }));
        } else {
          groupOut[specName] = typeof val === "string" ? val : String(val);
        }
      }
      specs[groupName] = groupOut;
    }
    return { specs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[extractProductData]", message);
    return { specs: null, error: message };
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
