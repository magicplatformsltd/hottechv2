-- Link products to categories. categories.id is BIGINT (BIGSERIAL).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products (category_id);
