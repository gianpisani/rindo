import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { sendBatchNotificationEmail } from '../_shared/email-notification.ts'
import { importBankMovements } from '../_shared/bank-import.ts'
import { encryptPassword, decryptPassword, encryptForTransit } from '../_shared/crypto.ts'

const OPEN_BANKING_BASE = 'https://open-banking-api-98187240066.southamerica-west1.run.app'

// ── Types from open-banking-chile API ────────────────────────────────────────

interface JobResponse {
  id: string
  bank: string
  status: 'queued' | 'running' | 'awaiting_2fa' | 'completed' | 'failed'
  progress?: string
  createdAt: number
  completedAt?: number
  result?: import('../_shared/bank-import.ts').ScrapeResult
  error?: string
}

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

    const jwt = authHeader.replace('Bearer ', '')
    const payload = JSON.parse(atob(jwt.split('.')[1]))
    const userId: string = payload.sub

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
      const encryptedCredentials = await encryptForTransit(rut, password)
      const scrapeBody: Record<string, string> = { bank, encryptedCredentials }
      if (fromDate) scrapeBody.fromDate = fromDate

      const scrapeRes = await fetch(`${OPEN_BANKING_BASE}/api/v1/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(scrapeBody),
      })

      if (!scrapeRes.ok) {
        const errText = await scrapeRes.text()
        console.error('Scrape error:', scrapeRes.status, errText)
        return new Response(
          JSON.stringify({ error: 'Error al iniciar la sincronización bancaria' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 },
        )
      }

      const { jobId, status } = await scrapeRes.json()
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

      const jobRes = await fetch(`${OPEN_BANKING_BASE}/api/v1/jobs/${jobId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })

      if (!jobRes.ok) {
        return new Response(
          JSON.stringify({ error: 'Error al consultar el estado del job' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 },
        )
      }

      const jobData = await jobRes.json() as JobResponse

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
      const { imported, skipped, importedItems, skippedItems } = await importBankMovements({
        supabaseClient,
        userId,
        result,
        trigger: 'manual',
        sendEmail: true,
      })

      console.log(`Bank sync complete for user ${userId}: imported=${imported}, skipped=${skipped}`)

      return new Response(
        JSON.stringify({ status: 'completed', imported, skipped, importedItems, skippedItems }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── ACTION: import-skipped ───────────────────────────────────────────────

    if (action === 'import-skipped') {
      const { movements } = body as {
        movements: { date: string; description: string; amount: number; type: string; card?: string }[]
      }

      if (!movements || !Array.isArray(movements) || movements.length === 0) {
        return new Response(
          JSON.stringify({ error: 'movements array es requerido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      const syncDate = new Date().toISOString().split('T')[0]
      let created = 0
      const toAutoCategorize: { id: string; detail: string }[] = []

      for (const m of movements) {
        const isoDate = convertDate(m.date, syncDate)
        const now = new Date()
        const insertDate = `${isoDate}T${now.toISOString().slice(11, 19)}`

        let cardId: string | null = null
        if (m.card) {
          const lastFour = m.card.replace(/\*/g, '')
          const { data: card } = await supabaseClient
            .from('credit_cards')
            .select('id')
            .eq('user_id', userId)
            .eq('last_4_digits', lastFour)
            .eq('is_active', true)
            .maybeSingle()
          if (card) cardId = card.id
        }

        const { data: inserted, error: insertError } = await supabaseClient
          .from('transactions')
          .insert({
            user_id: userId,
            date: insertDate,
            detail: `🤖 ${m.description}`,
            bank_description: m.description,
            type: m.type,
            amount: m.amount,
            category_name: 'Sin categoría',
            card_id: cardId,
            installment_id: null,
            reimbursement_for_category: null,
          })
          .select('id')
          .single()

        if (insertError) {
          console.error('Import-skipped insert error:', m.description, insertError)
        } else {
          created++
          toAutoCategorize.push({ id: inserted.id, detail: m.description })
        }
      }

      if (toAutoCategorize.length > 0) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!
        const { data: userCategories } = await supabaseClient
          .from('categories')
          .select('name')
          .eq('user_id', userId)
        const existingCategories = (userCategories ?? []).map((c: { name: string }) => c.name)
        await fetch(`${Deno.env.get('SUPABASE_URL')!}/functions/v1/auto-categorize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
          body: JSON.stringify({
            transactions: toAutoCategorize.map(({ id, detail }) => ({ id, detail: `🤖 ${detail}` })),
            userId,
            existingCategories,
          }),
        }).catch((e) => console.error('Batch auto-categorize error:', e))
      }

      if (created > 0) {
        try {
          const serviceRoleClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          )
          const { data: userData } = await serviceRoleClient.auth.admin.getUserById(userId)
          const userEmail = userData?.user?.email
          if (userEmail) {
            await sendBatchNotificationEmail({
              to: userEmail,
              bank: 'Banco',
              transactions: movements.map((m) => ({ date: m.date, description: m.description, amount: m.amount, type: m.type })),
            })
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

    // ── ACTION: save-credentials ──────────────────────────────────────────────

    if (action === 'save-credentials') {
      const { bank, rut, password, syncSchedule } = body

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
        .select('bank, rut, is_active, sync_schedule, last_sync_at, last_sync_status, last_error, consecutive_failures, created_at, updated_at')
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

// ── Helper (kept local for import-skipped action) ─────────────────────────────

function convertDate(ddmmyyyy: string, fallbackDate: string): string {
  if (ddmmyyyy.toLowerCase() === 'pendiente') return fallbackDate
  const [dd, mm, yyyy] = ddmmyyyy.split('-')
  return `${yyyy}-${mm}-${dd}`
}
