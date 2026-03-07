-- Product lifecycle dates: announced, released, discontinued.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS announcement_date DATE,
  ADD COLUMN IF NOT EXISTS discontinued_date DATE;

COMMENT ON COLUMN public.products.announcement_date IS 'Date the product was announced (e.g. press event).';
COMMENT ON COLUMN public.products.discontinued_date IS 'Date the product was discontinued, if applicable.';

-- Software/security update support (years).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS software_updates_years INTEGER,
  ADD COLUMN IF NOT EXISTS security_updates_years INTEGER;

COMMENT ON COLUMN public.products.software_updates_years IS 'Years of software/OS updates (e.g. 5).';
COMMENT ON COLUMN public.products.security_updates_years IS 'Years of security updates (e.g. 7).';
