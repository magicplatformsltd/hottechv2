-- Step 134.1: product_tags junction table (products <-> tags many-to-many).
-- Run in Supabase SQL editor (or via migration runner).

CREATE TABLE IF NOT EXISTS public.product_tags (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_product_tags_tag_id ON public.product_tags(tag_id);

ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_tags_public_read"
  ON public.product_tags FOR SELECT TO public USING (true);

CREATE POLICY "product_tags_authenticated_full_access"
  ON public.product_tags FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
