import { categorizeBankImport, type BankCategorizeItem } from '../_shared/bank-categorize.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { convertDate, emailBatchToUser, importBankMovements, insertBankMovement } from '../_shared/bank-import.ts'
import { encryptPassword, decryptPassword } from '../_shared/crypto.ts'
import { getJob, startScrape } from '../_shared/open-banking.ts'

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
    if (authError || !user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const userId = user.id

    const apiKey = Deno.env.get('OPEN_BANKING_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key no configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      )
    }

    const body = await req.json()
    const { action } = body

    // ── Shared scrape helper ──────────────────────────────────────────────────

    async function startScrapeJob(rut: string, password: string, bank: string, fromDate?: string): Promise<Response> {
      const started = await startScrape(apiKey!, { bank, rut, password, fromDate })
      if ('apiError' in started) {
        console.error('Scrape error:', started.apiError)
        return new Response(
          JSON.stringify({ error: 'Error al iniciar la sincronización bancaria' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 },
        )
      }

      const { jobId, status } = started
      return new Response(
        JSON.stringify({ jobId, status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── ACTION: start (credenciales manuales) ─────────────────────────────────

    if (action === 'start') {
      const { bank, rut, password, fromDate } = body

      if (!bank || !rut || !password) {
        return new Response(
          JSON.stringify({ error: 'bank, rut y password son requeridos' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      return startScrapeJob(rut, password, bank, fromDate)
    }

    // ── ACTION: start-stored (usa credenciales guardadas) ─────────────────────

    if (action === 'start-stored') {
      const { bank, fromDate } = body

      if (!bank) {
        return new Response(
          JSON.stringify({ error: 'bank es requerido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      const { data: cred, error: credError } = await supabaseClient
        .from('bank_sync_credentials')
        .select('rut, encrypted_password')
        .eq('user_id', userId)
        .eq('bank', bank)
        .maybeSingle()

      if (credError || !cred) {
        return new Response(
          JSON.stringify({ error: 'No hay credenciales guardadas para este banco' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
        )
      }

      const password = await decryptPassword(cred.encrypted_password)
      return startScrapeJob(cred.rut, password, bank, fromDate)
    }

    // ── ACTION: check ─────────────────────────────────────────────────────────

    if (action === 'check') {
      const { jobId } = body
      if (!jobId) {
        return new Response(
          JSON.stringify({ error: 'jobId es requerido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      const jobData = await getJob(apiKey, jobId)

      if ('apiError' in jobData) {
        return new Response(
          JSON.stringify({ error: 'Error al consultar el estado del job' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 },
        )
      }

      if (jobData.status !== 'completed' && jobData.status !== 'failed') {
        return new Response(
          JSON.stringify({ status: jobData.status, progress: jobData.progress ?? null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      if (jobData.status === 'failed') {
        return new Response(
          JSON.stringify({ status: 'failed', error: jobData.error ?? 'El banco reportó un error' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const result = jobData.result!

      const { data: syncCred } = await supabaseClient
        .from('bank_sync_credentials')
        .select('notify_email')
        .eq('user_id', userId)
        .eq('bank', result.bank)
        .maybeSingle()
      const notifyEmail = syncCred?.notify_email ?? true

      const { imported, skipped, importedItems, skippedItems } = await importBankMovements({
        supabaseClient,
        userId,
        result,
        trigger: 'manual',
        sendEmail: notifyEmail,
      })

      console.log(`Bank sync complete for user ${userId}: imported=${imported}, skipped=${skipped}`)

      return new Response(
        JSON.stringify({ status: 'completed', imported, skipped, importedItems, skippedItems }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── ACTION: import-skipped ───────────────────────────────────────────────

    if (action === 'import-skipped') {
      const { movements, bank: skippedBank } = body as {
        movements: { date: string; description: string; amount: number; type: string; card?: string }[]
        bank?: string
      }

      if (!movements || !Array.isArray(movements) || movements.length === 0) {
        return new Response(
          JSON.stringify({ error: 'movements array es requerido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      const syncDate = new Date().toISOString().split('T')[0]
      let created = 0
      const toAutoCategorize: BankCategorizeItem[] = []

      for (const m of movements) {
        const { id, error: insertError, category } = await insertBankMovement(supabaseClient, userId, {
          isoDate: convertDate(m.date, syncDate), description: m.description, type: m.type, amount: m.amount, card: m.card,
        })
        if (insertError) {
          console.error('Import-skipped insert error:', m.description, insertError)
        } else {
          created++
          // El pago de tarjeta ya entra categorizado.
          if (category === 'Sin categoría') toAutoCategorize.push({ id: id!, detail: m.description, type: m.type })
        }
      }

      await categorizeBankImport(supabaseClient, toAutoCategorize, userId,
        { apiKey: Deno.env.get('AI_GATEWAY_API_KEY') ?? '' })

      if (created > 0) {
        try {
          let notifyEmail = true
          if (skippedBank) {
            const { data: syncCred } = await supabaseClient
              .from('bank_sync_credentials')
              .select('notify_email')
              .eq('user_id', userId)
              .eq('bank', skippedBank)
              .maybeSingle()
            notifyEmail = syncCred?.notify_email ?? true
          }

          if (notifyEmail) {
            await emailBatchToUser(userId, skippedBank ?? 'Banco',
              movements.map((m) => ({ date: m.date, description: m.description, amount: m.amount, type: m.type })))
          }
        } catch (emailError) {
          console.error('⚠️ Email notification error (import-skipped):', emailError)
        }
      }

      return new Response(
        JSON.stringify({ created }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── ACTION: delete-imported ──────────────────────────────────────────────

    if (action === 'delete-imported') {
      const { ids } = body as { ids: string[] }

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return new Response(
          JSON.stringify({ error: 'ids array es requerido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      const { data: deleted, error: deleteError } = await supabaseClient
        .from('transactions')
        .delete()
        .in('id', ids)
        .eq('user_id', userId)
        .not('bank_description', 'is', null)
        .select('id')

      if (deleteError) {
        console.error('Delete-imported error:', deleteError)
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
        )
      }

      return new Response(
        JSON.stringify({ deleted: deleted?.length ?? 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── ACTION: save-credentials ──────────────────────────────────────────────

    if (action === 'save-credentials') {
      const { bank, rut, password, syncSchedule, notifyEmail } = body

      if (!bank || !rut || !password) {
        return new Response(
          JSON.stringify({ error: 'bank, rut y password son requeridos' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      const encryptedPassword = await encryptPassword(password)
      const schedule = syncSchedule ?? 'daily_20'

      const { error } = await supabaseClient
        .from('bank_sync_credentials')
        .upsert({
          user_id: userId,
          bank,
          rut,
          encrypted_password: encryptedPassword,
          sync_schedule: schedule,
          is_active: true,
          notify_email: notifyEmail ?? true,
          consecutive_failures: 0,
          last_sync_status: null,
          last_error: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,bank' })

      if (error) {
        console.error('Error saving credentials:', error)
        return new Response(
          JSON.stringify({ error: 'Error al guardar credenciales' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── ACTION: delete-credentials ────────────────────────────────────────────

    if (action === 'delete-credentials') {
      const { bank } = body

      if (!bank) {
        return new Response(
          JSON.stringify({ error: 'bank es requerido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      const { error } = await supabaseClient
        .from('bank_sync_credentials')
        .delete()
        .eq('user_id', userId)
        .eq('bank', bank)

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Error al eliminar credenciales' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── ACTION: update-schedule ───────────────────────────────────────────────

    if (action === 'update-schedule') {
      const { bank, syncSchedule } = body

      if (!bank || !syncSchedule) {
        return new Response(
          JSON.stringify({ error: 'bank y syncSchedule son requeridos' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      const { error } = await supabaseClient
        .from('bank_sync_credentials')
        .update({ sync_schedule: syncSchedule, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('bank', bank)

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Error al actualizar horario' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── ACTION: list-credentials ──────────────────────────────────────────────

    if (action === 'list-credentials') {
      const { data, error } = await supabaseClient
        .from('bank_sync_credentials')
        .select('bank, rut, is_active, sync_schedule, notify_email, last_sync_at, last_sync_status, last_error, consecutive_failures, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Error al obtener credenciales' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
        )
      }

      return new Response(
        JSON.stringify({ credentials: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ error: 'Acción inválida.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  } catch (error) {
    console.error('bank-sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})
