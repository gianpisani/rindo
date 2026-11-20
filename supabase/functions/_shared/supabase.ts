import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// deno-lint-ignore no-explicit-any
export type Client = SupabaseClient<any, 'public', any>

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Falta la variable de entorno ${name}`)
  return value
}

export function serviceClient(): Client {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))
}

export function bearerToken(req: Request): string | null {
  return req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null
}

export function userClient(req: Request): Client {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${bearerToken(req) ?? ''}` } },
  })
}

export async function authenticatedUser(req: Request): Promise<{ client: Client; userId: string } | null> {
  const token = bearerToken(req)
  if (!token) return null
  const client = userClient(req)
  const { data: { user }, error } = await client.auth.getUser(token)
  if (error || !user) return null
  return { client, userId: user.id }
}

export function isServiceRole(req: Request): boolean {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  return !!serviceRoleKey && req.headers.get('Authorization') === `Bearer ${serviceRoleKey}`
}
