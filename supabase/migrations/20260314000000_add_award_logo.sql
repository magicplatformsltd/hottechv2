-- Add logo support to product_awards (custom badge image).
ALTER TABLE public.product_awards
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
