-- Add copyright_text column to site_settings for customizable footer copyright.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS copyright_text TEXT;
