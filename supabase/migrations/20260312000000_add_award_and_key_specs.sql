-- Add award to products (global badge: NONE | BEST | RECOMMENDED).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS award TEXT NOT NULL DEFAULT 'NONE'
    CHECK (award IN ('NONE', 'BEST', 'RECOMMENDED'));

-- Add key_specs to product_templates (which spec schema labels are "key" for Review Box).
ALTER TABLE public.product_templates
  ADD COLUMN IF NOT EXISTS key_specs JSONB NOT NULL DEFAULT '[]'::jsonb;
