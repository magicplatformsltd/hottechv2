-- Junction table: many-to-many between posts and products (e.g. article references multiple hardware entities).

CREATE TABLE IF NOT EXISTS public.post_products (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, product_id)
);

-- RLS
ALTER TABLE public.post_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_products_public_read"
  ON public.post_products FOR SELECT TO public USING (true);

CREATE POLICY "post_products_authenticated_full_access"
  ON public.post_products FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
