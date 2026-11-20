import { importBankMovements, type ScrapeResult } from '../_shared/bank-import.ts'
import { decryptPassword } from '../_shared/crypto.ts'
import { sendBankSyncFailureEmail, userEmail } from '../_shared/email-notification.ts'
import { fail, json, preflight } from '../_shared/http.ts'
import { getJob, startScrape, type JobStatus } from '../_shared/open-banking.ts'
import { isServiceRole, serviceClient, type Client } from '../_shared/supabase.ts'

const POLL_INTERVAL_MS = 5_000
const POLL_MAX_ATTEMPTS = 24
const CIRCUIT_BREAKER_LIMIT = 5
const INVALID_CREDS_LIMIT = 3
const MAX_LOOKBACK_DAYS = 7
const CHILE_UTC_OFFSETS_STANDARD_AND_SUMMER = [3, 4]
const INVALID_CREDENTIALS_HINTS = ['incorrecto', 'bloqueado', 'inválido']

type FailureReason = 'circuit_breaker' | 'invalid_credentials' | '2fa_blocked'

interface Credential {
  id: string
  user_id: string
  bank: string
  rut: string
  encrypted_password: string
  notify_email: boolean
  consecutive_failures: number
}

interface JobPollResult {
  status: JobStatus
  result?: ScrapeResult
  error?: string
}

function schedulesForCurrentHour(): string[] {
  const utcHour = new Date().getUTCHours()
  const chileHours = new Set(CHILE_UTC_OFFSETS_STANDARD_AND_SUMMER.map((offset) => (utcHour + 24 - offset) % 24))
  const schedules: string[] = []
  for (const hour of chileHours) {
    if (hour === 8) schedules.push('daily_08', 'twice_daily')
    if (hour === 14) schedules.push('daily_14')
    if (hour === 20) schedules.push('daily_20', 'twice_daily')
    schedules.push(`custom_${hour.toString().padStart(2, '0')}`)
  }
  return [...new Set(schedules)]
}

function scraperFromDateInSantiago(daysBack: number): string {
  const nowChile = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }))
  nowChile.setDate(nowChile.getDate() - daysBack)
  const dd = String(nowChile.getDate()).padStart(2, '0')
  const mm = String(nowChile.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${nowChile.getFullYear()}`
}

function daysMissedSinceLastSuccess(consecutiveFailures: number): number {
  return Math.min(consecutiveFailures + 1, MAX_LOOKBACK_DAYS)
}

async function pollJob(jobId: string, apiKey: string): Promise<JobPollResult> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    const job = await getJob(apiKey, jobId)
    if ('apiError' in job) return { status: 'failed', error: job.apiError }
    if (job.status === 'awaiting_2fa') return { status: 'awaiting_2fa', error: '2FA requerida — sync automático no puede continuar' }
    if (job.status === 'completed') return { status: 'completed', result: job.result }
    if (job.status === 'failed') return { status: 'failed', error: job.error ?? 'Scraping falló' }
  }
  return { status: 'failed', error: 'Timeout esperando resultado del banco' }
}

async function logSync(supabase: Client, cred: Credential, entry: { status: string; imported?: number; skipped?: number; error?: string | null; importedItems?: unknown[]; skippedItems?: unknown[] }) {
  const { error } = await supabase.from('bank_sync_log').insert({
    user_id: cred.user_id,
    bank: cred.bank,
    trigger: 'cron',
    imported: entry.imported ?? 0,
    skipped: entry.skipped ?? 0,
    status: entry.status,
    error: entry.error ?? null,
    imported_items: entry.importedItems ?? [],
    skipped_items: entry.skippedItems ?? [],
  })
  if (error) console.error(`No se pudo registrar el sync de ${cred.user_id}/${cred.bank}:`, error)
}

async function updateCredential(supabase: Client, cred: Credential, changes: Record<string, unknown>) {
  const { error } = await supabase.from('bank_sync_credentials').update(changes).eq('id', cred.id)
  if (error) console.error(`No se pudo actualizar la credencial de ${cred.user_id}/${cred.bank}:`, error)
}

async function recordFailure(supabase: Client, cred: Credential, status: string, failures: number, error: string | undefined) {
  await updateCredential(supabase, cred, {
    last_sync_at: new Date().toISOString(),
    last_sync_status: status,
    last_error: error ?? null,
    consecutive_failures: failures,
  })
  await logSync(supabase, cred, { status, error })
}

async function deactivateAndNotify(supabase: Client, cred: Credential, reason: FailureReason) {
  await updateCredential(supabase, cred, { is_active: false })
  if (!cred.notify_email) return
  try {
    const to = await userEmail(supabase, cred.user_id)
    if (to) await sendBankSyncFailureEmail({ to, bank: cred.bank, reason })
  } catch (error) {
    console.error(`⚠️ No se pudo avisar la desactivación de ${cred.user_id}/${cred.bank}:`, error)
  }
}

function looksLikeInvalidCredentials(error: string | undefined): boolean {
  const message = (error ?? '').toLowerCase()
  return INVALID_CREDENTIALS_HINTS.some((hint) => message.includes(hint))
}

async function syncCredential(supabase: Client, cred: Credential, apiKey: string): Promise<{ status: string; imported?: number; skipped?: number; error?: string }> {
  const password = await decryptPassword(cred.encrypted_password)
  const lookbackDays = daysMissedSinceLastSuccess(cred.consecutive_failures)
  const fromDate = scraperFromDateInSantiago(lookbackDays)

  const started = await startScrape(apiKey, { bank: cred.bank, rut: cred.rut, password, fromDate })
  if ('apiError' in started) throw new Error(started.apiError)
  console.log(`Usuario ${cred.user_id} banco ${cred.bank}: job ${started.jobId} iniciado (desde ${fromDate}, ${lookbackDays}d)`)

  const poll = await pollJob(started.jobId, apiKey)
  const failures = cred.consecutive_failures + 1

  if (poll.status === 'awaiting_2fa') {
    await recordFailure(supabase, cred, '2fa_blocked', failures, '2FA requerida')
    await deactivateAndNotify(supabase, cred, '2fa_blocked')
    return { status: '2fa_blocked' }
  }

  if (poll.status === 'failed') {
    const invalidCredentials = looksLikeInvalidCredentials(poll.error)
    const status = invalidCredentials ? 'invalid_credentials' : 'failed'
    await recordFailure(supabase, cred, status, failures, poll.error)
    if (failures >= CIRCUIT_BREAKER_LIMIT || (invalidCredentials && failures >= INVALID_CREDS_LIMIT)) {
      await deactivateAndNotify(supabase, cred, invalidCredentials ? 'invalid_credentials' : 'circuit_breaker')
    }
    return { status, error: poll.error }
  }

  const imported = await importBankMovements({
    supabaseClient: supabase,
    userId: cred.user_id,
    result: poll.result!,
    trigger: 'cron',
    sendEmail: cred.notify_email,
  })
  await logSync(supabase, cred, {
    status: 'success',
    imported: imported.imported,
    skipped: imported.skipped,
    importedItems: imported.importedItems,
    skippedItems: imported.skippedItems,
  })
  await updateCredential(supabase, cred, {
    last_sync_at: new Date().toISOString(),
    last_sync_status: 'success',
    last_error: null,
    consecutive_failures: 0,
  })
  console.log(`Usuario ${cred.user_id} banco ${cred.bank}: ${imported.imported} importadas, ${imported.skipped} ignoradas`)
  return { status: 'success', imported: imported.imported, skipped: imported.skipped }
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse
  if (!isServiceRole(req)) return fail(401, 'No autorizado')

  const startTime = Date.now()
  const schedulesToRun = schedulesForCurrentHour()
  const apiKey = Deno.env.get('OPEN_BANKING_API_KEY') ?? ''
  console.log(`bank-sync-all: hora UTC ${new Date().getUTCHours()}, schedules activos: ${schedulesToRun.join(', ')}`)

  const supabase = serviceClient()
  const { data: credentials, error: fetchError } = await supabase
    .from('bank_sync_credentials')
    .select('id, user_id, bank, rut, encrypted_password, sync_schedule, notify_email, consecutive_failures, last_sync_status')
    .eq('is_active', true)
    .lt('consecutive_failures', CIRCUIT_BREAKER_LIMIT)
    .in('sync_schedule', schedulesToRun)
  if (fetchError) {
    console.error('Error fetching credentials:', fetchError)
    return json({ success: false, error: 'No se pudieron leer las credenciales' }, 500)
  }

  if (!credentials?.length) {
    console.log('No hay credenciales activas para los schedules:', schedulesToRun)
    return json({ success: true, message: 'No hay credenciales configuradas para esta hora', duration_ms: Date.now() - startTime })
  }

  console.log(`Procesando ${credentials.length} banco(s)...`)

  let banksSynced = 0
  let transactionsImported = 0
  let errorsCount = 0
  let twoFaBlocked = 0
  const details: unknown[] = []

  for (const cred of credentials as Credential[]) {
    const { user_id: userId, bank } = cred
    try {
      const outcome = await syncCredential(supabase, cred, apiKey)
      if (outcome.status === 'success') {
        banksSynced++
        transactionsImported += outcome.imported ?? 0
      } else if (outcome.status === '2fa_blocked') {
        twoFaBlocked++
      } else {
        errorsCount++
      }
      details.push({ userId, bank, ...outcome })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Error procesando ${userId}/${bank}:`, error)
      errorsCount++
      await recordFailure(supabase, cred, 'failed', cred.consecutive_failures + 1, message)
      details.push({ userId, bank, status: 'failed', error: message })
    }
  }

  const duration = Date.now() - startTime
  console.log(`bank-sync-all completado: ${banksSynced} bancos, ${transactionsImported} transacciones, ${errorsCount} errores, ${twoFaBlocked} 2FA en ${duration}ms`)

  return json({
    success: true,
    stats: { banks_synced: banksSynced, transactions_imported: transactionsImported, errors: errorsCount, two_fa_blocked: twoFaBlocked, duration_ms: duration },
    details,
  })
})
