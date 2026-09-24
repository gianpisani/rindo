import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Imports that use the service client must establish the owner before reading
// personal history or spending the provider key. A user ID alone is not auth.
export async function canCategorizeOwner(client: SupabaseClient, authorization: string | null, owner: string, serviceKey: string) {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return false
  if (serviceKey && token === serviceKey) return true
  try {
    const { data: { user }, error } = await client.auth.getUser(token)
    return !error && user?.id === owner
  } catch { return false }
}
