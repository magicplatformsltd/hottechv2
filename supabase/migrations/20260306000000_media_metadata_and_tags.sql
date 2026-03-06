-- Media metadata expansion and many-to-many tags
-- Adds title, source_credit to media_items; creates media_tag_map join table.

-- =============================================================================
-- 1. Add columns to media_items (alt_text already exists)
-- =============================================================================
ALTER TABLE public.media_items
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS source_credit TEXT;

-- =============================================================================
-- 2. media_tag_map join table (many-to-many: media_items <-> tags)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.media_tag_map (
  media_id UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, tag_id)
);

-- Index for reverse lookups (tags -> media)
CREATE INDEX IF NOT EXISTS idx_media_tag_map_tag_id ON public.media_tag_map(tag_id);

-- Enable RLS
ALTER TABLE public.media_tag_map ENABLE ROW LEVEL SECURITY;

-- Policy: Public read
CREATE POLICY "media_tag_map_public_read"
  ON public.media_tag_map FOR SELECT TO public
  USING (true);

-- Policy: Admin full access
CREATE POLICY "media_tag_map_admin_full_access"
  ON public.media_tag_map FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
