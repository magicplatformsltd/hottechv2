-- Products: draft vs live (draft_data) and status/published_at for alignment with posts.
-- Live data remains in existing columns; draft_data holds the staging payload until publish.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS draft_data JSONB;

COMMENT ON COLUMN public.products.status IS 'draft | published | pending_review. Same semantics as posts.';
COMMENT ON COLUMN public.products.published_at IS 'When the product is/was published; future = scheduled.';
COMMENT ON COLUMN public.products.draft_data IS 'Staging payload (mirrors live columns); shown in preview, applied to live on publish.';

-- Existing rows: treat as published so public listing still works.
UPDATE public.products
SET status = 'published', published_at = COALESCE(updated_at, created_at)
WHERE status = 'draft' AND published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_status_published_at
  ON public.products(status, published_at DESC NULLS LAST);
