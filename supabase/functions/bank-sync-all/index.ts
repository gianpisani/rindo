// Edge Function: bank-sync-all
// Ejecutada cada hora por pg_cron. Filtra las credenciales según sync_schedule
// y ejecuta el scraping de cada banco configurado por cada usuario.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { decryptPassword, encryptForTransit } from '../_shared/crypto.ts'
import { importBankMovements } from '../_shared/bank-import.ts'
import { sendBankSyncFailureEmail } from '../_shared/email-notification.ts'

const OPEN_BANKING_BASE = 'https://open-banking-api-98187240066.southamerica-west1.run.app'
const POLL_INTERVAL_MS = 5_000
const POLL_MAX_ATTEMPTS = 24  // 24 × 5s = 120s max per job
const CIRCUIT_BREAKER_LIMIT = 5
const INVALID_CREDS_LIMIT = 3

// ── Schedule resolution ───────────────────────────────────────────────────────

/**
 * Returns the sync schedules that should run at the current UTC hour,
 * mapped to Chile time (UTC-3 standard / UTC-4 DST).
 * We run at both -3 and -4 offsets to cover daylight saving transitions.
 */
function getSchedulesForCurrentHour(): string[] {
  const utcHour = new Date().getUTCHours()

  // Chile Standard Time = UTC-3 | Chile Summer Time = UTC-4
  const chileHourStd = (utcHour + 24 - 3) % 24   // UTC-3
  const chileHourDst = (utcHour + 24 - 4) % 24   // UTC-4

  const schedules: string[] = []
  const pad = (n: number) => n.toString().padStart(2, '0')

  for (const hour of new Set([chileHourStd, chileHourDst])) {
    if (hour === 8)  schedules.push('daily_08', 'twice_daily')
    if (hour === 14) schedules.push('daily_14')
    if (hour === 20) schedules.push('daily_20', 'twice_daily')
    schedules.push(`custom_${pad(hour)}`)
  }

  return [...new Set(schedules)]
}

// ── Job polling ───────────────────────────────────────────────────────────────

type JobStatus = 'queued' | 'running' | 'awaiting_2fa' | 'completed' | 'failed'

interface JobPollResult {
  status: JobStatus
  result?: import('../_shared/bank-import.ts').ScrapeResult
  error?: string
}

async function pollJob(jobId: string, apiKey: string): Promise<JobPollResult> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

    const res = await fetch(`${OPEN_BANKING_BASE}/api/v1/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      return { status: 'failed', error: `Job poll HTTP ${res.status}` }
    }

    const data = await res.json()

    if (data.status === 'awaiting_2fa') {
      return { status: 'awaiting_2fa', error: '2FA requerida — sync automático no puede continuar' }
    }

    if (data.status === 'completed') {
      return { status: 'completed', result: data.result }
    }

    if (data.status === 'failed') {
      return { status: 'failed', error: data.error ?? 'Scraping falló' }
    }

    // queued or running — keep polling
  }

  return { status: 'failed', error: 'Timeout esperando resultado del banco' }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only callable with service_role_key
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!authHeader.includes(serviceRoleKey)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
    )
  }

  const startTime = Date.now()
  const schedulesToRun = getSchedulesForCurrentHour()
  const apiKey = Deno.env.get('OPEN_BANKING_API_KEY') ?? ''

  console.log(`bank-sync-all: hora UTC ${new Date().getUTCHours()}, schedules activos: ${schedulesToRun.join(', ')}`)

  if (schedulesToRun.length === 0) {
    return new Response(
      JSON.stringify({ success: true, message: 'No hay bancos programados para esta hora', duration_ms: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey,
  )

  // Fetch all active credentials whose schedule matches the current hour
  const { data: credentials, error: fetchError } = await supabase
    .from('bank_sync_credentials')
    .select('id, user_id, bank, rut, encrypted_password, sync_schedule, consecutive_failures, last_sync_status')
    .eq('is_active', true)
    .lt('consecutive_failures', CIRCUIT_BREAKER_LIMIT)
    .in('sync_schedule', schedulesToRun)

  if (fetchError) {
    console.error('Error fetching credentials:', fetchError)
    return new Response(
      JSON.stringify({ success: false, error: fetchError.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }

  if (!credentials || credentials.length === 0) {
    console.log('No hay credenciales activas para los schedules:', schedulesToRun)
    return new Response(
      JSON.stringify({ success: true, message: 'No hay credenciales configuradas para esta hora', duration_ms: Date.now() - startTime }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  console.log(`Procesando ${credentials.length} banco(s)...`)

  let banksSynced = 0
  let transactionsImported = 0
  let errorsCount = 0
  let twoFaBlocked = 0
  const details: unknown[] = []

  // Process each credential sequentially to respect rate limits
  for (const cred of credentials) {
    const { id: credId, user_id: userId, bank, rut, encrypted_password, consecutive_failures } = cred

    try {
      // Decrypt password from at-rest storage
      const password = await decryptPassword(encrypted_password)

      // Encrypt for transit to the Open Banking API
      const encryptedCredentials = await encryptForTransit(rut, password)

      // Calculate yesterday's date for fromDate
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const dd = String(yesterday.getDate()).padStart(2, '0')
      const mm = String(yesterday.getMonth() + 1).padStart(2, '0')
      const yyyy = yesterday.getFullYear()
      const fromDate = `${dd}-${mm}-${yyyy}`

      // Start scraping job
      const scrapeRes = await fetch(`${OPEN_BANKING_BASE}/api/v1/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ bank, encryptedCredentials, fromDate }),
      })

      if (!scrapeRes.ok) {
        const errText = await scrapeRes.text()
        throw new Error(`Scrape API error ${scrapeRes.status}: ${errText}`)
      }

      const { jobId } = await scrapeRes.json()
      console.log(`Usuario ${userId} banco ${bank}: job ${jobId} iniciado`)

      // Poll for result
      const pollResult = await pollJob(jobId, apiKey)

      if (pollResult.status === 'awaiting_2fa') {
        twoFaBlocked++
        await updateCredentialStatus(supabase, credId, userId, bank, '2fa_blocked', consecutive_failures + 1, '2FA requerida')
        details.push({ userId, bank, status: '2fa_blocked' })

        // Notify user and deactivate if they keep requiring 2FA
        const getUserEmail = async () => {
          const { data } = await supabase.auth.admin.getUserById(userId)
          return data?.user?.email
        }
        const userEmail = await getUserEmail()
        if (userEmail) {
          await sendBankSyncFailureEmail({ to: userEmail, bank, reason: '2fa_blocked' }).catch(() => {})
        }
        // Deactivate for 2FA permanently — user needs to re-enable manually
        await supabase
          .from('bank_sync_credentials')
          .update({ is_active: false })
          .eq('id', credId)
        continue
      }

      if (pollResult.status === 'failed') {
        errorsCount++
        const isInvalidCreds = (pollResult.error ?? '').toLowerCase().includes('incorrecto') ||
          (pollResult.error ?? '').toLowerCase().includes('bloqueado') ||
          (pollResult.error ?? '').toLowerCase().includes('inválido')

        const newFailures = consecutive_failures + 1
        const newStatus = isInvalidCreds ? 'invalid_credentials' : 'failed'

        await updateCredentialStatus(supabase, credId, userId, bank, newStatus, newFailures, pollResult.error)

        // Circuit breaker — deactivate after too many failures
        if (newFailures >= CIRCUIT_BREAKER_LIMIT || (isInvalidCreds && newFailures >= INVALID_CREDS_LIMIT)) {
          await supabase
            .from('bank_sync_credentials')
            .update({ is_active: false })
            .eq('id', credId)

          const { data } = await supabase.auth.admin.getUserById(userId)
          const userEmail = data?.user?.email
          if (userEmail) {
            await sendBankSyncFailureEmail({
              to: userEmail,
              bank,
              reason: isInvalidCreds ? 'invalid_credentials' : 'circuit_breaker',
            }).catch(() => {})
          }
        }

        details.push({ userId, bank, status: newStatus, error: pollResult.error })
        continue
      }

      // Completed — import movements
      const importResult = await importBankMovements({
        supabaseClient: supabase,
        userId,
        result: pollResult.result!,
        trigger: 'cron',
        sendEmail: true,
      })

      // Write to bank_sync_log
      await supabase.from('bank_sync_log').insert({
        user_id: userId,
        bank,
        trigger: 'cron',
        imported: importResult.imported,
        skipped: importResult.skipped,
        status: 'success',
        imported_items: importResult.importedItems,
        skipped_items: importResult.skippedItems,
      })

      // Reset failures on success
      await supabase
        .from('bank_sync_credentials')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'success',
          last_error: null,
          consecutive_failures: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', credId)

      banksSynced++
      transactionsImported += importResult.imported
      details.push({ userId, bank, status: 'success', imported: importResult.imported, skipped: importResult.skipped })
      console.log(`Usuario ${userId} banco ${bank}: ${importResult.imported} importadas, ${importResult.skipped} ignoradas`)

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Error procesando ${userId}/${bank}:`, message)
      errorsCount++
      const newFailures = cred.consecutive_failures + 1
      await updateCredentialStatus(supabase, credId, userId, bank, 'failed', newFailures, message)
      details.push({ userId, bank, status: 'failed', error: message })
    }
  }

  const duration = Date.now() - startTime
  console.log(`bank-sync-all completado: ${banksSynced} bancos, ${transactionsImported} transacciones, ${errorsCount} errores, ${twoFaBlocked} 2FA en ${duration}ms`)

  return new Response(
    JSON.stringify({
      success: true,
      stats: { banks_synced: banksSynced, transactions_imported: transactionsImported, errors: errorsCount, two_fa_blocked: twoFaBlocked, duration_ms: duration },
      details,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})

// ── Helper ────────────────────────────────────────────────────────────────────

async function updateCredentialStatus(
  supabase: ReturnType<typeof createClient>,
  credId: string,
  userId: string,
  bank: string,
  status: string,
  failures: number,
  error: string | undefined,
) {
  await supabase
    .from('bank_sync_credentials')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
      last_error: error ?? null,
      consecutive_failures: failures,
      updated_at: new Date().toISOString(),
    })
    .eq('id', credId)

  await supabase.from('bank_sync_log').insert({
    user_id: userId,
    bank,
    trigger: 'cron',
    imported: 0,
    skipped: 0,
    status,
    error: error ?? null,
    imported_items: [],
    skipped_items: [],
  })
}
