import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { loadEnv, type Plugin } from 'vite'
import { createLocalCategorizer } from './jev-local-server'
import { tryJevPoc } from '../supabase/functions/_shared/jev-poc'

export function jevLocalPlugin(): Plugin {
  return {
    name: 'rindo-local-categorizer', apply: 'serve',
    configureServer(server) {
      // Fixed local configuration at startup; HTTP input never chooses a file.
      const file = path.join(server.config.root, '.env.jev.local')
      const secrets = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {}
      const env = loadEnv(server.config.mode, server.config.root, 'VITE_')
      server.middlewares.use(createLocalCategorizer(async (authorization, body) => {
        const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: authorization } },
          auth: { persistSession: false, autoRefreshToken: false },
        })
        return tryJevPoc(client, body, {
          apiKey: secrets.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_API_KEY || '',
          accessToken: authorization.slice('Bearer '.length),
        })
      }))
    },
  }
}
