import type { IncomingMessage, ServerResponse } from 'node:http'

type Categorize = (authorization: string, body: { transactionId: string }) => Promise<unknown>

// Only the existing create-movement flow uses this development adapter.
export function createLocalCategorizer(categorize: Categorize) {
  let active = 0
  let started = Date.now()
  let count = 0
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url !== '/__auto-categorize') return next()
    const send = (status: number, data: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(data))
    }
    let url: URL
    try { url = new URL(`http://${req.headers.host}`) } catch { return send(403, { success: false }) }
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') ||
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        req.headers.origin !== url.origin || req.headers['x-rindo-jev'] !== '1') return send(403, { success: false })
    if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json') return send(405, { success: false })
    const authorization = req.headers.authorization
    if (!authorization?.startsWith('Bearer ')) return send(401, { success: false })
    if (Date.now() - started >= 60_000) { started = Date.now(); count = 0 }
    if (count >= 60 || active >= 4) return send(429, { success: false })
    active++
    try {
      let size = 0
      const chunks: Buffer[] = []
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk)
        if (size > 4096) return send(413, { success: false })
        chunks.push(Buffer.from(chunk))
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!body || typeof body.transactionId !== 'string' || body.transactionId.length > 100 || !body.transactionId) return send(400, { success: false })
      count++
      // The callback verifies the session with Supabase and reads owner-scoped data.
      send(200, await categorize(authorization, { transactionId: body.transactionId }))
    } catch {
      send(400, { success: false })
    } finally { active-- }
  }
}
