-- Ensure products RLS allows INSERT/UPDATE with status 'pending_review' (and draft, published).
-- The existing products_authenticated_full_access uses USING (true) WITH CHECK (true), so no status
-- restriction; this migration makes that explicit and ensures no policy restricts by status.

-- Drop and recreate so any ad-hoc status restriction is removed
DROP POLICY IF EXISTS "products_authenticated_full_access" ON public.products;

CREATE POLICY "products_authenticated_full_access"
  ON public.products
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "products_authenticated_full_access" ON public.products IS
  'Authenticated users can INSERT/UPDATE/SELECT/DELETE any row; status (draft, published, pending_review) is not restricted.';
