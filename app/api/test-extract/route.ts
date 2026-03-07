/**
 * STEP 108 – Temporary integration test route for AI product extraction.
 * GET /api/test-extract?url=<encoded-url>&templateId=<uuid>
 * Use a GSMArena (or similar) URL and the "Phones" template ID to verify extraction.
 * URL is logged as received; ( ) and other special chars are encoded in the fetcher via encodeURIComponent.
 * Remove or restrict in production.
 */

import { NextResponse } from "next/server";
import { extractProductData } from "@/lib/actions/ai-extractor";

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

  console.log("Received URL for extraction:", url);
  const result = await extractProductData(url, templateId);

  if (result.error) {
    const status = result.statusCode ?? 422;
    return NextResponse.json({ error: result.error, specs: null }, { status });
  }

  return NextResponse.json({
    success: true,
    specs: result.specs,
    message: "Extracted specs matching SpecGroup[] schema. Use specs to populate ProductForm state.",
  });
}
