-- Products table for tech hardware reviews and comparison blocks.

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  release_date DATE,
  hero_image TEXT,
  transparent_image TEXT,
  specs JSONB NOT NULL DEFAULT '{}',
  affiliate_links JSONB NOT NULL DEFAULT '{}',
  editorial_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_public_read"
  ON public.products FOR SELECT TO public USING (true);

CREATE POLICY "products_authenticated_full_access"
  ON public.products FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Optional: trigger to keep updated_at in sync (matches common pattern)
CREATE OR REPLACE FUNCTION public.set_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_products_updated_at();
