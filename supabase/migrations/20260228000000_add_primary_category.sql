-- Add primary_category_id to posts for canonical category (SEO, display).
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS primary_category_id INTEGER REFERENCES public.categories(id) ON DELETE SET NULL;
