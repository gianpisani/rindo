// Explicit release operation, never run from the application or a pull request.
import { readFile } from 'node:fs/promises'
import { classifyWithJev } from '../supabase/functions/_shared/jev-categorizer.ts'

const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref,
  AI_GATEWAY_API_KEY: key, RINDO_CATEGORY_OWNER_EMAIL: email } = process.env
// Verified against the Supabase origin in the live rindo.cl application.
if (ref?.trim() !== 'fxlztcwqmlmhqwzbrebo' || !token || !key || !email) {
  throw new Error('Expected Rindo project and release secrets are required')
}
async function api(path, body) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(60_000),
  })
  // Never print response bodies: they can contain personal data or credentials.
  if (!response.ok) throw new Error(`Supabase ${path}: HTTP ${response.status}`)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}
const query = (sql, parameters = []) => api('database/query', { query: sql, parameters })
const owners = await query('SELECT id FROM auth.users WHERE lower(email) = lower($1)', [email])
if (!Array.isArray(owners) || owners.length !== 1) throw new Error('Expected exactly one owner')
const owner = owners[0].id
const schema = await query(`SELECT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conrelid = 'public.categories'::regclass
  AND contype = 'u' AND pg_get_constraintdef(oid) = 'UNIQUE (name, user_id, type)'
) AS ready`)
if (!schema[0]?.ready) throw new Error('Category uniqueness differs from expected schema')
await api('secrets', [{ name: 'AI_GATEWAY_API_KEY', value: key }])
console.log('Server Gateway secret configured')

const version = '20260923120000'
const history = await query('SELECT version FROM supabase_migrations.schema_migrations WHERE version = $1', [version])
if (history.length === 0) {
  const sql = await readFile(new URL('../supabase/migrations/20260923120000_category_context.sql', import.meta.url), 'utf8')
  // One transaction, including migration bookkeeping. No older migrations run.
  await query(`BEGIN;
    SET LOCAL lock_timeout = '10s';
    ${sql}
    INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
      VALUES ('20260923120000', 'category_context', ARRAY['Category context release']);
    COMMIT;`)
  console.log('Category context migration applied and recorded')
} else console.log('Category context migration already applied')

await query('SELECT public.configure_food_categories($1::uuid)', [owner])
const categories = await query(`SELECT count(*)::int AS count FROM public.categories
  WHERE user_id = $1::uuid AND is_active AND type = 'Gasto'
  AND name IN ('Supermercado', 'Café y snacks', 'Comida diaria', 'Comidas y panoramas')
  AND length(description) > 0`, [owner])
if (categories[0]?.count !== 4) throw new Error('Food category verification failed')
console.log('Verified four active food categories for the selected owner; historical transactions untouched')
const options = await query(`SELECT id, name, type, description, is_active FROM public.categories
  WHERE user_id = $1::uuid AND is_active AND type = 'Gasto'`, [owner])
const smoke = await classifyWithJev({ detail: 'café y barrita en el trabajo', type: 'Gasto' }, options, { apiKey: key })
if (smoke.status !== 'accepted' || smoke.category !== 'Café y snacks') {
  throw new Error('Jev synthetic smoke test failed; no transaction was created')
}
console.log('Live Jev smoke test passed using production category definitions; no transaction created')
