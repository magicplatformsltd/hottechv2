-- Add timezone column to site_settings for CMS timezone-awareness.
-- Default: America/New_York (ET) for consistent date handling.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
