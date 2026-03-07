-- Product-entity routing: post_type (editorial type slug) and primary_product_id on posts.
-- Content type slug (e.g. 'reviews', 'news') and primary product UUID for high-speed routing.
-- Junction tables (post_content_types, post_products) remain for backward compatibility.

-- Editorial content type for routing (slug from content_types: reviews, news, versus, etc.).
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS post_type TEXT;

COMMENT ON COLUMN public.posts.post_type IS 'Editorial type slug for routing (e.g. reviews, news); synced from post_content_types.';

-- Denormalized primary product for fast routing and product hub link.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS primary_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.posts.primary_product_id IS 'Primary product for this post; synced from post_products where is_primary = true.';

-- Index for routing by post_type.
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON public.posts(post_type) WHERE post_type IS NOT NULL;

-- Index for "posts for this product" (e.g. product hub related content).
CREATE INDEX IF NOT EXISTS idx_posts_primary_product_id ON public.posts(primary_product_id) WHERE primary_product_id IS NOT NULL;
