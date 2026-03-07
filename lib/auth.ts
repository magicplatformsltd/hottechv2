/**
 * Server-side auth helpers. Use in routes/layouts that need to check admin/editor.
 */

import { createClient } from "@/utils/supabase/server";

const ALLOWED_ADMIN_EMAILS = ["web@nirave.co"];

/**
 * True if the current request has an authenticated user whose email is in the allowed admin list.
 * Use for draft/preview access and scheduled content visibility.
 */
export async function getIsAdmin(): Promise<boolean> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const email = user?.email?.toLowerCase?.()?.trim();
  return !!user && !!email && ALLOWED_ADMIN_EMAILS.includes(email);
}
