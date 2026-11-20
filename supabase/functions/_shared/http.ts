export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(body: unknown, status = 200, cors: Record<string, string> = corsHeaders): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

export function fail(status: number, message: string, cors: Record<string, string> = corsHeaders): Response {
  return json({ error: message }, status, cors)
}

export function preflight(req: Request, cors: Record<string, string> = corsHeaders): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: cors }) : null
}
