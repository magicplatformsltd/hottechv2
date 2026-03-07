# STEP 107: Product Blueprint & Form State Audit for AI Ingestion

**Objective:** Map how the "Blueprint" (Template) selection drives the form fields and determine how an AI ingester can programmatically "fill" these dynamic inputs. Audit only.

---

## Task 1: Blueprint Dependency Audit

### 1.1 ProductForm and Blueprint (Template) Selection

- **Component:** `components/admin/ProductForm.tsx`
- **Blueprint UI:** A `<select>` labeled **"Blueprint"** (heading "Blueprint", label "Product template (required)") with `value={templateId}` and `onChange={(e) => handleTemplateChange(e.target.value)}`.
- **State:** `templateId` is `useState<string | "">(initial.template_id ?? "")`. Options come from the `templates` prop (array of `ProductTemplate` from `getTemplates()`).
- **Data source for templates:** The product edit page `app/(admin)/admin/products/[id]/page.tsx` (and new-product flow) loads templates with `getTemplates()` from `lib/actions/template.ts`, which reads the `product_templates` table. Those rows are passed into `ProductForm` as `templates={templates}`.

### 1.2 How Spec Fields Are Generated from the Template

- **Schema source:** Each template has `spec_schema` (from DB: `product_templates.spec_schema`, JSONB). It is either a legacy `string[]` of spec names or a `SpecGroup[]` (see `lib/types/template.ts`: `SpecGroup` with `groupName` and `specs: SpecItem[]`, and `SpecItem` with `name`, `isKey`, `type?`, `matrixConfig?`).
- **Normalization:** `getTemplateSchemaAsGroups(template.spec_schema)` (from `lib/types/template.ts`) turns that into a single shape: `SpecGroup[]`. Legacy string arrays become one group `"General"` with one spec per string.
- **When template is applied:**
  - **On Blueprint change:** `handleTemplateChange(newTemplateId)` runs → `setTemplateId(newTemplateId)` and, if a template is found, `applyTemplateSchema(template)`.
  - **applyTemplateSchema(template):**
    - Calls `setSpecGroups((prev) => initializeSpecs(prev, getTemplateSchemaAsGroups(template.spec_schema)))` so spec state is rebuilt from the template's schema.
    - Also updates `setSubScores` from `template.score_schema` (labels for editorial sub-scores).
  - **On load:** A `useEffect` runs when `templateId`/`templates` are set and re-applies `applyTemplateSchema(template)` so existing product data is merged with the current template schema.
- **Spec state shape:** `specGroups` is `ProductSpecsNested`: `Record<groupName, Record<specName, value>>` where `value` is either a string, or a structured value for non-text types (e.g. `VariantMatrixEntry[]`, `BooleanWithDetails`, `CameraLensData`, `DisplayPanelData`, `IpRatingEntry[]`). So the form does **not** fetch a separate "JSON schema" file; it uses the template's `spec_schema` (and optionally `score_schema`) from the already-fetched `ProductTemplate` objects.

### 1.3 State Management of Dynamic Spec Fields and JSONB

- **State variable:** `specGroups` is `useState<ProductSpecsNested>(() => initializeSpecs(initial.specs, getTemplateSchemaAsGroups(...)))`.
- **Initialization:** `initializeSpecs(productSpecs, templateSchema)` in `ProductForm.tsx` (lines 152–259):
  - Accepts current product specs (flat or nested) and the template's `SpecGroup[]`.
  - Builds a new `ProductSpecsNested`: for each group and each spec in the schema it sets a value from existing product data (with migration from flat to nested and type-specific defaults for `variant_matrix`, `boolean`, `camera_lens`, `display_panel`, `ip_rating`).
- **Updaters:** Spec state is updated only through dedicated setters; the form never replaces the whole schema, only values:
  - `updateSpecValue(groupName, specName, value)` — plain text.
  - `updateVariantMatrix`, `addVariantMatrixRow`, `removeVariantMatrixRow`.
  - `updateBooleanSpec`.
  - `updateDisplayPanel`, `updateCameraLens`, `updateIpRating`, `addIpRatingRow`, `removeIpRatingRow`.
  - All of these call `setSpecGroups` with a function that clones the nested structure and updates one group/spec (or one row in a repeater).
- **Submit:** In `handleSubmit`, the payload is built with `specs: specGroups` (line 691). So the same nested structure is sent to `upsertProduct` and persisted into the `products.specs` JSONB column.

**Summary:** The template (Blueprint) drives which spec *groups* and *specs* exist and their types. The form state is a single nested object keyed by group then spec; that object is both the editing state and the JSONB payload. There is no separate "schema" fetch at form runtime—only the `templates` prop (from `product_templates`) and `getTemplateSchemaAsGroups(template.spec_schema)`.

---

## Task 2: Ingestion Entry Point

### 2.1 Best Place to Trigger the AI Ingester After a Blueprint Is Selected

- **Inside ProductForm (single-product flow):** Once a Blueprint is selected, the spec fields are already rendered from `selectedTemplate.spec_schema`. A natural place for "fill from AI" is:
  - A button near the Blueprint dropdown (e.g. "Fill from URL" / "Extract specs") that is enabled when `hasTemplate` is true, or
  - A section (e.g. above or below the spec accordions) that appears when `hasTemplate` is true and offers "Import from URL" or "Paste spec text" and then runs an AI extraction and applies the result to the same form state (see Task 4).
- **Flow:** User selects Blueprint → spec fields appear → user clicks "Fill from AI" (or similar) → AI returns structured data → code calls the same `setSpecGroups` / `updateSpecValue` / type-specific updaters so the form state is updated and the user can edit and save. No new page is strictly required for single-product ingestion if the AI is invoked from this form.

### 2.2 Sidebar and "Import Products" for Bulk Operations

- **Sidebar:** `app/(admin)/admin/admin-sidebar.tsx`. Navigation is defined in `navGroups`. The **"Products & Reviews"** group (lines 26–33) currently has:
  - Products
  - Add New Product
  - Templates
  - Awards
- **Where to add "Import Products":** Add a new link in that same group, e.g.:
  - `{ href: "/admin/products/import", label: "Import Products" }`
- **Import Hub page:** Create a new route that only exists in the file system; the sidebar does not define routes. Recommended location:
  - **Page:** `app/(admin)/admin/products/import/page.tsx`
  - So the "Import Hub" is at **`/admin/products/import`**, and the sidebar entry above is the way users get there for bulk operations.

---

## Task 3: Backend Capability Check

### 3.1 package.json (Markdown / Scraping)

- **Checked:** `package.json` (project root).
- **Found:** No `turndown`, `cheerio`, or `jina`. No other markdown-conversion or HTML-scraping libraries in dependencies.
- **Present:** `openai` (e.g. `^6.21.0`), `rss-parser`, `@supabase/supabase-js`, and app-specific deps (Next, React, TipTap, etc.).

### 3.2 OpenAI / Gemini in the Codebase

- **OpenAI:** Used in `app/api/ingest/route.ts`: `import OpenAI from "openai"` and `new OpenAI({ apiKey })`. That route uses the API for classification (category/tags/content_type from article content), not for product spec extraction. There is no shared `lib/openai.ts` or `lib/ai.ts`; the client is created inside the ingest route.
- **Gemini:** Not present in the repo (no `@google/generative-ai` or similar).
- **Conclusion:** Only OpenAI is implemented, and only in the ingest API route. Product-focused AI (e.g. "extract specs from URL") would either reuse that route pattern (new endpoint or same route with different mode) or a new `lib` module that creates an OpenAI client and is used by both the ingest route and a future product-import flow.

---

## Task 4: Output Report

### 4.1 Relationship Between Template Selection and Specs JSONB State

- **Template** = one row from `product_templates` (id, name, slug, `spec_schema`, `score_schema`, etc.). The form receives a list of these as `templates` and the chosen one as `selectedTemplate`.
- **spec_schema** (and optionally legacy string array) is normalized to **SpecGroup[]** via `getTemplateSchemaAsGroups(template.spec_schema)`. That array defines:
  - Group names and which spec items exist;
  - Per-spec: `name`, `type` (text, variant_matrix, boolean, camera_lens, display_panel, ip_rating), and for variant_matrix, `matrixConfig`.
- **Spec state** is a single nested object, `ProductSpecsNested`, keyed by group name then spec name, with values that match the spec type (string, array of pairs, boolean+details, camera/display/ip structures). This is the same shape stored in `products.specs` (JSONB).
- **Flow:** Template selected → `applyTemplateSchema` → `initializeSpecs(prev, schema)` → `setSpecGroups(...)`. All edits go through the existing updaters → `setSpecGroups`. On submit, `specGroups` is sent as `specs` to the server and written to the DB. So: **Template drives the *structure* of the form and of the JSONB; the form state *is* the JSONB payload.**

### 4.2 How the AI Can Set Form State Programmatically

- **Option A – Same process as user edits:** The AI (or any importer) should produce a structure that matches `ProductSpecsNested`: same group names and spec names as in the selected template's schema, and values in the correct type (string, variant matrix array, boolean+details, camera_lens object, etc.). Then the form state can be set in one of two ways:
  - **Replace:** `setSpecGroups(initializeSpecs(aiPayload, getTemplateSchemaAsGroups(selectedTemplate.spec_schema)))` so the AI payload is merged with the template schema (and defaults) the same way existing product data is. If the AI payload is already keyed by group/spec and uses the right types, this will work; `initializeSpecs` will prefer values from the first argument when they exist.
  - **Incremental:** For each group/spec, call the existing updaters (`updateSpecValue`, `updateVariantMatrix`, etc.) so the form behaves as if the user had typed the values. This is more verbose but avoids any subtle mismatches in shape.
- **Option B – New product + template:** For bulk import, the backend (or a server action) can create products with `template_id` and `specs` JSONB set directly from the AI output, then redirect or list the new products. The admin UI can then open each product in the existing ProductForm; the form will load that product's `specs` and template and show them. So "setting form state" can mean either (1) calling the same setters from an in-form "Fill from AI" flow, or (2) writing to the DB and letting the form load that state when the user opens the product.

**Recommendation:** For a "Fill from AI" button on ProductForm, have the AI return a `ProductSpecsNested`-shaped object (or a minimal flat map that you convert to nested by group/spec from the current template). Then call `setSpecGroups(initializeSpecs(aiResult, getTemplateSchemaAsGroups(selectedTemplate.spec_schema)))` so one function call updates the whole spec form; optionally also set `name`, `brand`, `slug`, etc., with their existing setters if the AI provides them.

### 4.3 File Locations

| Purpose | File / path |
|--------|-------------|
| Product form (Blueprint + spec state) | `components/admin/ProductForm.tsx` |
| Template types and schema normalization | `lib/types/template.ts` |
| Product types (specs, nested shape) | `lib/types/product.ts` |
| Template CRUD / fetch | `lib/actions/template.ts` |
| Product CRUD (includes specs JSONB) | `lib/actions/product.ts` |
| Admin sidebar (nav links) | `app/(admin)/admin/admin-sidebar.tsx` |
| Products list page | `app/(admin)/admin/products/page.tsx` |
| New/Edit product page (loads ProductForm + templates) | `app/(admin)/admin/products/[id]/page.tsx` (id can be `"new"`) |
| **Suggested "Import Hub" page for bulk** | **`app/(admin)/admin/products/import/page.tsx`** (to be created) |
| Existing AI (OpenAI) usage | `app/api/ingest/route.ts` |

---

## Summary

- The Blueprint is the selected `ProductTemplate`; its `spec_schema` (and `getTemplateSchemaAsGroups`) defines which spec fields exist and their types. The form keeps one nested object (`specGroups`) that is the live spec state and the JSONB payload.
- AI can "fill" the form by producing a compatible nested structure and calling `setSpecGroups(initializeSpecs(aiData, schema))`, or by writing products to the DB and opening them in the existing form.
- For bulk, add "Import Products" in the sidebar under Products & Reviews and add the Import Hub at `app/(admin)/admin/products/import/page.tsx`.
- No markdown/scraping libs or Gemini are present; only OpenAI is used in the ingest route.
