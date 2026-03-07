-- Product awards: dynamic badges with custom labels and style_settings.
CREATE TABLE IF NOT EXISTS public.product_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'Award',
  style_settings JSONB NOT NULL DEFAULT '{"bg_color":"rgba(234,179,8,0.2)","text_color":"#eab308","border_style":"solid"}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_product_awards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_awards_updated_at
  BEFORE UPDATE ON public.product_awards
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_product_awards_updated_at();

ALTER TABLE public.product_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_awards_public_read"
  ON public.product_awards FOR SELECT TO public USING (true);

CREATE POLICY "product_awards_authenticated_full"
  ON public.product_awards FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Replace products.award (text) with award_id (FK to product_awards).
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_award_check;
ALTER TABLE public.products DROP COLUMN IF EXISTS award;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS award_id UUID REFERENCES public.product_awards (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_award_id ON public.products (award_id);
