import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { categorizeBatchForUser, tryJevPoc } from '../_shared/jev-poc.ts'

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' }
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  try {
    const body = await req.json()
    const config = { apiKey: Deno.env.get('AI_GATEWAY_API_KEY') ?? '', accessToken: token }
    if (Array.isArray(body.transactions)) {
      const { data: { user }, error } = await client.auth.getUser(token)
      if (error || !user) return new Response(JSON.stringify({ success: false }), { status: 401, headers })
      if (body.transactions.length > 200 || body.transactions.some((tx: { id?: unknown }) => typeof tx?.id !== 'string')) {
        return new Response(JSON.stringify({ success: false }), { status: 400, headers })
      }
      const results = await categorizeBatchForUser(client, [...new Set<string>(body.transactions.map((tx: { id: string }) => tx.id))], user.id, config)
      return new Response(JSON.stringify({ success: true, results }), { headers })
    }
    const result = await tryJevPoc(client, body, config)
    return new Response(JSON.stringify(result), { headers })
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'No se pudo categorizar el movimiento' }), { status: 400, headers })
  }
})
