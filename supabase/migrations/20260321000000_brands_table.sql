-- Step 134: Dedicated brands table and products.brand_id FK.
-- Run this in the Supabase SQL editor (or via migration runner).

-- 1. Create brands table
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brands_public_read"
  ON public.brands FOR SELECT TO public USING (true);

CREATE POLICY "brands_authenticated_full_access"
  ON public.brands FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 2. Add brand_id to products (nullable until backfill)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

-- 3. Backfill: one brand row per distinct slug (dedupe by slug to avoid unique violation)
INSERT INTO public.brands (name, slug)
  SELECT min(name) AS name, slug
  FROM (
    SELECT trim(brand) AS name,
           lower(regexp_replace(trim(brand), '\s+', '-', 'g')) AS slug
    FROM public.products
    WHERE brand IS NOT NULL AND trim(brand) <> ''
  ) sub
  GROUP BY slug
  ON CONFLICT (slug) DO NOTHING;

-- Match products to brands by slug (handles "Apple" / "APPLE" and "A B" / "A-B")
UPDATE public.products p
SET brand_id = b.id
FROM public.brands b
WHERE b.slug = lower(regexp_replace(trim(p.brand), '\s+', '-', 'g'))
  AND p.brand_id IS NULL;

-- 4. Drop legacy brand column
ALTER TABLE public.products
  DROP COLUMN IF EXISTS brand;

-- 5. Optional: make brand_id NOT NULL if every product has a brand (uncomment if desired)
-- ALTER TABLE public.products
--   ALTER COLUMN brand_id SET NOT NULL;
