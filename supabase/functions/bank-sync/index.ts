import { categorizeBankImport, type BankCategorizeItem } from '../_shared/bank-categorize.ts'
import { convertDate, emailBatchToUser, importBankMovements, insertBankMovement, type ImportedItem } from '../_shared/bank-import.ts'
import { UNCATEGORIZED } from '../_shared/category-rules.ts'
import { decryptPassword, encryptPassword } from '../_shared/crypto.ts'
import { fail, json, preflight } from '../_shared/http.ts'
import { getJob, startScrape } from '../_shared/open-banking.ts'
import { authenticatedUser, type Client } from '../_shared/supabase.ts'

const DEFAULT_SYNC_SCHEDULE = 'daily_20'
const CREDENTIAL_COLUMNS = 'bank, rut, is_active, sync_schedule, notify_email, last_sync_at, last_sync_status, last_error, consecutive_failures, created_at, updated_at'

interface ActionContext {
  client: Client
  userId: string
  apiKey: string
  // deno-lint-ignore no-explicit-any
  body: Record<string, any>
}

type Action = (ctx: ActionContext) => Promise<Response>

interface SkippedMovement { date: string; description: string; amount: number; type: string; card?: string }

async function wantsEmail(client: Client, userId: string, bank: string): Promise<boolean> {
  const { data, error } = await client
    .from('bank_sync_credentials')
    .select('notify_email')
    .eq('user_id', userId)
    .eq('bank', bank)
    .maybeSingle()
  if (error) throw error
  return data?.notify_email ?? true
}

async function startScrapeJob(apiKey: string, credentials: { bank: string; rut: string; password: string; fromDate?: string }): Promise<Response> {
  const started = await startScrape(apiKey, credentials)
  if ('apiError' in started) {
    console.error('Scrape error:', started.apiError)
    return fail(502, 'Error al iniciar la sincronización bancaria')
  }
  return json({ jobId: started.jobId, status: started.status })
}

const start: Action = ({ apiKey, body: { bank, rut, password, fromDate } }) => {
  if (!bank || !rut || !password) return Promise.resolve(fail(400, 'bank, rut y password son requeridos'))
  return startScrapeJob(apiKey, { bank, rut, password, fromDate })
}

const startStored: Action = async ({ client, userId, apiKey, body: { bank, fromDate } }) => {
  if (!bank) return fail(400, 'bank es requerido')

  const { data: cred, error } = await client
    .from('bank_sync_credentials')
    .select('rut, encrypted_password')
    .eq('user_id', userId)
    .eq('bank', bank)
    .maybeSingle()
  if (error) throw error
  if (!cred) return fail(404, 'No hay credenciales guardadas para este banco')

  return startScrapeJob(apiKey, { bank, rut: cred.rut, password: await decryptPassword(cred.encrypted_password), fromDate })
}

const check: Action = async ({ client, userId, apiKey, body: { jobId } }) => {
  if (!jobId) return fail(400, 'jobId es requerido')

  const job = await getJob(apiKey, jobId)
  if ('apiError' in job) {
    console.error('Job poll error:', job.apiError)
    return fail(502, 'Error al consultar el estado del job')
  }
  if (job.status === 'failed') return json({ status: 'failed', error: job.error ?? 'El banco reportó un error' })
  if (job.status !== 'completed') return json({ status: job.status, progress: job.progress ?? null })

  const result = job.result!
  const { imported, skipped, importedItems, skippedItems } = await importBankMovements({
    supabaseClient: client,
    userId,
    result,
    trigger: 'manual',
    sendEmail: await wantsEmail(client, userId, result.bank),
  })
  console.log(`Bank sync complete for user ${userId}: imported=${imported}, skipped=${skipped}`)
  return json({ status: 'completed', imported, skipped, importedItems, skippedItems })
}

const importSkipped: Action = async ({ client, userId, body }) => {
  const { movements, bank } = body as { movements?: SkippedMovement[]; bank?: string }
  if (!Array.isArray(movements) || movements.length === 0) return fail(400, 'movements array es requerido')

  const syncDate = new Date().toISOString().split('T')[0]
  const created: ImportedItem[] = []
  const toAutoCategorize: BankCategorizeItem[] = []

  for (const m of movements) {
    const { id, error, category } = await insertBankMovement(client, userId, {
      isoDate: convertDate(m.date, syncDate), description: m.description, type: m.type, amount: m.amount, card: m.card,
    })
    if (error) {
      console.error('Import-skipped insert error:', error)
      continue
    }
    created.push({ id: id!, date: m.date, description: m.description, amount: m.amount, type: m.type })
    if (category === UNCATEGORIZED) toAutoCategorize.push({ id: id!, detail: m.description, type: m.type })
  }

  await categorizeBankImport(client, toAutoCategorize, userId, { apiKey: Deno.env.get('AI_GATEWAY_API_KEY') ?? '' })

  if (created.length > 0) {
    try {
      const notify = bank ? await wantsEmail(client, userId, bank) : true
      if (notify) await emailBatchToUser(userId, bank ?? 'Banco', created)
    } catch (error) {
      console.error('⚠️ Email notification error (import-skipped):', error)
    }
  }

  return json({ created: created.length })
}

const deleteImported: Action = async ({ client, userId, body: { ids } }) => {
  if (!Array.isArray(ids) || ids.length === 0) return fail(400, 'ids array es requerido')

  const { data: deleted, error } = await client
    .from('transactions')
    .delete()
    .in('id', ids)
    .eq('user_id', userId)
    .not('bank_description', 'is', null)
    .select('id')
  if (error) {
    console.error('Delete-imported error:', error)
    return fail(500, 'Error al eliminar los movimientos importados')
  }
  return json({ deleted: deleted?.length ?? 0 })
}

const saveCredentials: Action = async ({ client, userId, body: { bank, rut, password, syncSchedule, notifyEmail } }) => {
  if (!bank || !rut || !password) return fail(400, 'bank, rut y password son requeridos')

  const { error } = await client
    .from('bank_sync_credentials')
    .upsert({
      user_id: userId,
      bank,
      rut,
      encrypted_password: await encryptPassword(password),
      sync_schedule: syncSchedule ?? DEFAULT_SYNC_SCHEDULE,
      is_active: true,
      notify_email: notifyEmail ?? true,
      consecutive_failures: 0,
      last_sync_status: null,
      last_error: null,
    }, { onConflict: 'user_id,bank' })
  if (error) {
    console.error('Error saving credentials:', error)
    return fail(500, 'Error al guardar credenciales')
  }
  return json({ success: true })
}

const deleteCredentials: Action = async ({ client, userId, body: { bank } }) => {
  if (!bank) return fail(400, 'bank es requerido')

  const { error } = await client
    .from('bank_sync_credentials')
    .delete()
    .eq('user_id', userId)
    .eq('bank', bank)
  if (error) {
    console.error('Error deleting credentials:', error)
    return fail(500, 'Error al eliminar credenciales')
  }
  return json({ success: true })
}

const updateSchedule: Action = async ({ client, userId, body: { bank, syncSchedule } }) => {
  if (!bank || !syncSchedule) return fail(400, 'bank y syncSchedule son requeridos')

  const { error } = await client
    .from('bank_sync_credentials')
    .update({ sync_schedule: syncSchedule })
    .eq('user_id', userId)
    .eq('bank', bank)
  if (error) {
    console.error('Error updating schedule:', error)
    return fail(500, 'Error al actualizar horario')
  }
  return json({ success: true })
}

const listCredentials: Action = async ({ client, userId }) => {
  const { data, error } = await client
    .from('bank_sync_credentials')
    .select(CREDENTIAL_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('Error listing credentials:', error)
    return fail(500, 'Error al obtener credenciales')
  }
  return json({ credentials: data })
}

const actions = new Map<string, Action>([
  ['start', start],
  ['start-stored', startStored],
  ['check', check],
  ['import-skipped', importSkipped],
  ['delete-imported', deleteImported],
  ['save-credentials', saveCredentials],
  ['delete-credentials', deleteCredentials],
  ['update-schedule', updateSchedule],
  ['list-credentials', listCredentials],
])

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  try {
    const session = await authenticatedUser(req)
    if (!session) return fail(401, 'No autenticado')

    const apiKey = Deno.env.get('OPEN_BANKING_API_KEY')
    if (!apiKey) return fail(500, 'API key no configurada')

    const body = await req.json()
    const action = actions.get(body.action)
    if (!action) return fail(400, 'Acción inválida.')

    return await action({ ...session, apiKey, body })
  } catch (error) {
    console.error('bank-sync error:', error)
    return fail(500, 'Error inesperado en la sincronización bancaria')
  }
})
