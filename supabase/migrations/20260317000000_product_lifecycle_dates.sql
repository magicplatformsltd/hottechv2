-- Product lifecycle dates: announced, released, discontinued.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS announcement_date DATE,
  ADD COLUMN IF NOT EXISTS discontinued_date DATE;

COMMENT ON COLUMN public.products.announcement_date IS 'Date the product was announced (e.g. press event).';
COMMENT ON COLUMN public.products.discontinued_date IS 'Date the product was discontinued, if applicable.';
