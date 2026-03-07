-- Add tier to product_awards (GOLD, SILVER, BRONZE, FLAT).
ALTER TABLE public.product_awards
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'FLAT'
    CHECK (tier IN ('GOLD', 'SILVER', 'BRONZE', 'FLAT'));
