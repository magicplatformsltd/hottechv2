/**
 * STEP 108 – Temporary integration test route for AI product extraction + import.
 * GET /api/test-extract?url=<encoded-url>&templateId=<uuid>
 * Extracts specs using template-driven schema, normalizes with applyTemplateTypes, then imports via service role.
 * Remove or restrict in production.
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getTemplateById } from "@/lib/actions/template";
import { getTemplateSchemaAsGroups } from "@/lib/types/template";
import { extractProductData } from "@/lib/actions/ai-extractor";
import { importProductWithClient, applyTemplateTypes } from "@/lib/actions/product";

/** Service role client so curl / server-to-server calls can insert without a user session. */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for test-extract import.");
  }
  return createClient(url, key);
}

/** Build URL-safe slug from product name (e.g. "Nothing Phone (2a)" → "nothing-phone-2a"). */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "imported";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const templateId = searchParams.get("templateId");

  if (!url || !templateId) {
    return NextResponse.json(
      { error: "Missing url or templateId. Use ?url=https://...&templateId=<uuid>" },
      { status: 400 }
    );
  }

  console.log("[test-extract] Received URL:", url);

  const template = await getTemplateById(templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  const schema = getTemplateSchemaAsGroups(template.spec_schema);
  const fieldCount = schema.reduce((acc, g) => acc + (g.specs?.length ?? 0), 0);
  console.log(`[test-extract] Loaded template: ${template.name} with ${fieldCount} fields.`);

  const result = await extractProductData(url, templateId);

  if (result.error) {
    const status = result.statusCode ?? 422;
    return NextResponse.json({ error: result.error, specs: null, identity: null, import: null }, { status });
  }

  const specs = result.specs ?? {};
  const identity = result.identity;
  if (!identity) {
    return NextResponse.json(
      { error: "Extraction succeeded but identity (brand, modelName) is missing.", specs, identity: null, import: null },
      { status: 422 }
    );
  }

  const { brand, modelName } = identity;
  const name = `${brand} ${modelName}`.trim() || "Imported Product";
  const slug = slugify(name) || `imported-${Date.now()}`;

  console.log("[test-extract] AI-identified brand:", brand, "modelName:", modelName, "→ name:", name, "slug:", slug);

  const normalizedSpecs = await applyTemplateTypes(specs, schema);
  const draftPayload = {
    name,
    brand,
    slug,
    template_id: templateId,
    specs: normalizedSpecs,
  };
  console.log("[Normalization] Pre-insert payload: Performance.Processor =", (normalizedSpecs as Record<string, Record<string, unknown>>)["Performance"]?.Processor, "| Memory.RAM + Storage =", (normalizedSpecs as Record<string, Record<string, unknown>>)["Memory"]?.["RAM + Storage"]);
  console.log("[test-extract] Final normalized draft_data:", JSON.stringify(draftPayload));

  const importPayload = {
    name,
    brand,
    slug,
    template_id: templateId,
    specs: normalizedSpecs,
  };

  let importResult: { product?: { id: string; slug: string }; error?: string };
  try {
    const adminClient = getSupabaseAdmin();
    const out = await importProductWithClient(adminClient, importPayload);
    importResult = out.error
      ? { error: out.error }
      : { product: out.product ? { id: out.product.id, slug: out.product.slug } : undefined };
    if (out.error) {
      console.error("[test-extract] importProduct error:", out.error);
    } else if (out.product) {
      console.log("[test-extract] importProduct success, id:", out.product.id);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[test-extract] importProduct threw:", message);
    importResult = { error: message };
  }

  return NextResponse.json({
    success: true,
    specs,
    identity: { brand, modelName },
    import: importResult,
    derived: { name, brand, modelName, slug },
    message: importResult.error
      ? "Extraction succeeded; import failed. See import.error in response and server logs."
      : "Extraction and import succeeded. Product created with status pending_review.",
  });
}
