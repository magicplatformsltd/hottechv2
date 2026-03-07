-- Product templates (blueprint engine) for hardware categories.
-- Links to products via products.template_id.

-- Block A: Create product_templates table
CREATE TABLE IF NOT EXISTS public.product_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  spec_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  score_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_product_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_templates_updated_at
  BEFORE UPDATE ON public.product_templates
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_product_templates_updated_at();

-- Block B: Alter products table – add template_id and FK
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.product_templates (id) ON DELETE SET NULL;

-- Optional index for lookups by template
CREATE INDEX IF NOT EXISTS idx_products_template_id ON public.products (template_id);

-- Block C: RLS on product_templates
ALTER TABLE public.product_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_templates_public_read"
  ON public.product_templates FOR SELECT TO public USING (true);

CREATE POLICY "product_templates_authenticated_full_access"
  ON public.product_templates FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
