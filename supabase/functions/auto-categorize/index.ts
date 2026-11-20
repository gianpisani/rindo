import { categorizeBatchForUser, categorizeForSession } from '../_shared/categorize.ts'
import { json, preflight } from '../_shared/http.ts'
import { authenticatedUser, bearerToken, userClient } from '../_shared/supabase.ts'

const MAX_BATCH_SIZE = 200

Deno.serve(async req => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  try {
    const body = await req.json()
    const apiKey = Deno.env.get('AI_GATEWAY_API_KEY') ?? ''

    if (Array.isArray(body.transactions)) {
      const session = await authenticatedUser(req)
      if (!session) return json({ success: false }, 401)
      if (body.transactions.length > MAX_BATCH_SIZE || body.transactions.some((tx: { id?: unknown }) => typeof tx?.id !== 'string')) {
        return json({ success: false }, 400)
      }
      const ids = [...new Set<string>(body.transactions.map((tx: { id: string }) => tx.id))]
      const results = await categorizeBatchForUser(session.client, ids, session.userId, { apiKey })
      return json({ success: true, results })
    }

    return json(await categorizeForSession(userClient(req), body, { apiKey, accessToken: bearerToken(req) ?? '' }))
  } catch (error) {
    console.error('auto-categorize error:', error)
    return json({ success: false, error: 'No se pudo categorizar el movimiento' }, 400)
  }
})
