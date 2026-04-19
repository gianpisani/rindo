import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

const OPEN_BANKING_BASE = 'https://open-banking-api-98187240066.southamerica-west1.run.app'

// ── Types from open-banking-chile API ────────────────────────────────────────

interface Movement {
  date: string         // "DD-MM-YYYY"
  description: string
  amount: number       // positive = abono (income), negative = cargo (expense)
  balance: number
  source: string
  card?: string        // last 4 digits
  installments?: string
  totalAmount?: number
  owner?: string
}

interface Account {
  label: string
  balance: number
  movements: Movement[]
}

interface CreditCard {
  label: string
  movements: Movement[]
}

interface ScrapeResult {
  success: boolean
  bank: string
  accounts: Account[]
  creditCards: CreditCard[]
}

interface JobResponse {
  id: string
  bank: string
  status: 'queued' | 'running' | 'awaiting_2fa' | 'completed' | 'failed'
  progress?: string
  createdAt: number
  completedAt?: number
  result?: ScrapeResult
  error?: string
}

// ── Helper: "DD-MM-YYYY" → "YYYY-MM-DD" ─────────────────────────────────────

function convertDate(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split('-')
  return `${yyyy}-${mm}-${dd}`
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const jwt = authHeader.replace('Bearer ', '')
    const payload = JSON.parse(atob(jwt.split('.')[1]))
    const userId: string = payload.sub

    const apiKey = Deno.env.get('OPEN_BANKING_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key no configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const body = await req.json()
    const { action } = body

    // ── ACTION: start ─────────────────────────────────────────────────────────

    if (action === 'start') {
      const { bank, rut, password, fromDate } = body

      if (!bank || !rut || !password) {
        return new Response(
          JSON.stringify({ error: 'bank, rut y password son requeridos' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const scrapeBody: Record<string, string> = { bank, rut, password }
      if (fromDate) scrapeBody.fromDate = fromDate

      const scrapeRes = await fetch(`${OPEN_BANKING_BASE}/api/v1/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(scrapeBody),
      })

      if (!scrapeRes.ok) {
        const errText = await scrapeRes.text()
        console.error('Scrape error:', scrapeRes.status, errText)
        return new Response(
          JSON.stringify({ error: 'Error al iniciar la sincronización bancaria' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
        )
      }

      const { jobId, status } = await scrapeRes.json()
      return new Response(
        JSON.stringify({ jobId, status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── ACTION: check ─────────────────────────────────────────────────────────

    if (action === 'check') {
      const { jobId } = body
      if (!jobId) {
        return new Response(
          JSON.stringify({ error: 'jobId es requerido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const jobRes = await fetch(`${OPEN_BANKING_BASE}/api/v1/jobs/${jobId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })

      if (!jobRes.ok) {
        const errText = await jobRes.text()
        console.error('Job poll error:', jobRes.status, errText)
        return new Response(
          JSON.stringify({ error: 'Error al consultar el estado del job' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
        )
      }

      const jobData = await jobRes.json() as JobResponse

      // Still running — relay status to frontend
      if (jobData.status !== 'completed' && jobData.status !== 'failed') {
        return new Response(
          JSON.stringify({ status: jobData.status, progress: jobData.progress ?? null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (jobData.status === 'failed') {
        return new Response(
          JSON.stringify({ status: 'failed', error: jobData.error ?? 'El banco reportó un error' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // ── Completed: import movements ───────────────────────────────────────

      const result = jobData.result!
      let imported = 0
      let skipped = 0
      const toAutoCategorize: { id: string; detail: string }[] = []

      // Merge all movements and deduplicate in-memory first
      // (the API may return the same movement from multiple accounts/cards)
      const seenKeys = new Set<string>()
      const allMovements: Movement[] = [
        ...(result.accounts ?? []).flatMap(a => a.movements),
        ...(result.creditCards ?? []).flatMap(cc => cc.movements),
      ].filter(m => {
        const key = `${m.date}|${m.amount}|${m.description}`
        if (seenKeys.has(key)) return false
        seenKeys.add(key)
        return true
      })

      for (const movement of allMovements) {
        const absAmount = Math.abs(movement.amount)

        // Skip zero-amount movements (would violate CHECK amount > 0)
        if (absAmount === 0) {
          skipped++
          continue
        }

        const isoDate = convertDate(movement.date)
        // Use movement date + current execution time so the timestamp is closer to real
        const now = new Date()
        const insertDate = `${isoDate}T${now.toISOString().slice(11, 19)}`
        // Next day for open-ended date range (matches any time within the day)
        const nextDay = new Date(isoDate)
        nextDay.setDate(nextDay.getDate() + 1)
        const nextDayStr = nextDay.toISOString().split('T')[0]

        const description = movement.description
        const type = movement.amount > 0 ? 'Ingreso' : 'Gasto'

        // Deduplication — compare only year-month-day (date is TIMESTAMPTZ).
        // Use .limit(1) instead of .maybeSingle() to avoid PGRST116 errors when
        // there are already multiple duplicates in the DB (maybeSingle returns
        // { data: null } for 2+ rows, which would incorrectly allow another insert).

        // 1. Skip if a bank-imported transaction with the same description already exists
        const { data: existingBankRows } = await supabaseClient
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .gte('date', isoDate)
          .lt('date', nextDayStr)
          .eq('amount', absAmount)
          .eq('bank_description', description)
          .limit(1)

        // 2. Skip if a manually entered transaction (no bank_description) matches by date+amount
        const { data: existingManualRows } = await supabaseClient
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .gte('date', isoDate)
          .lt('date', nextDayStr)
          .eq('amount', absAmount)
          .is('bank_description', null)
          .limit(1)

        if ((existingBankRows && existingBankRows.length > 0) || (existingManualRows && existingManualRows.length > 0)) {
          skipped++
          continue
        }

        // Match credit card by last 4 digits (movement.card comes as "****6976")
        let cardId: string | null = null
        if (movement.card) {
          const lastFour = movement.card.replace(/\*/g, '')
          const { data: card } = await supabaseClient
            .from('credit_cards')
            .select('id')
            .eq('user_id', userId)
            .eq('last_4_digits', lastFour)
            .eq('is_active', true)
            .maybeSingle()

          if (card) {
            cardId = card.id
            console.log(`💳 Tarjeta matched: ****${lastFour} → ${card.id}`)
          }
        }

        const { data: inserted, error: insertError } = await supabaseClient
          .from('transactions')
          .insert({
            user_id: userId,
            date: insertDate,
            detail: `🤖 ${description}`,
            bank_description: description,
            type,
            amount: absAmount,
            category_name: 'Sin categoría',
            card_id: cardId,
            installment_id: null,
            reimbursement_for_category: null,
          })
          .select('id')
          .single()

        if (insertError) {
          console.error('Insert error for movement:', movement.date, movement.description, insertError)
        } else {
          imported++
          toAutoCategorize.push({ id: inserted.id, detail: description })
        }
      }

      // Auto-categorize all inserted transactions in parallel reusing the existing
      // auto-categorize edge function (exact history → fuzzy Jaccard → keywords)
      if (toAutoCategorize.length > 0) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!
        await Promise.all(
          toAutoCategorize.map(({ id, detail }) =>
            fetch(`${supabaseUrl}/functions/v1/auto-categorize`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                transactionId: id,
                detail: `🤖 ${detail}`,
                userId,
                existingCategories: [],
              }),
            }).catch(e => console.error('Auto-categorize error for', detail, e))
          )
        )
      }

      console.log(`Bank sync complete for user ${userId}: imported=${imported}, skipped=${skipped}`)

      return new Response(
        JSON.stringify({ status: 'completed', imported, skipped }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Acción inválida. Use "start" o "check".' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )

  } catch (error) {
    console.error('bank-sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
