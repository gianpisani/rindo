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

function convertDate(ddmmyyyy: string, fallbackDate: string): string {
  if (ddmmyyyy.toLowerCase() === 'pendiente') return fallbackDate
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
      const importedItems: { date: string; description: string; amount: number; type: string }[] = []
      const skippedItems: { date: string; description: string; amount: number; type: string; reason: string; card?: string }[] = []

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

      const syncDate = new Date().toISOString().split('T')[0]

      for (const movement of allMovements) {
        const absAmount = Math.abs(movement.amount)
        const type = movement.amount > 0 ? 'Ingreso' : 'Gasto'

        // Skip zero-amount movements (would violate CHECK amount > 0)
        if (absAmount === 0) {
          skipped++
          skippedItems.push({ date: movement.date, description: movement.description, amount: absAmount, type, reason: 'zero_amount' })
          continue
        }

        const isoDate = convertDate(movement.date, syncDate)
        // Use movement date + current execution time so the timestamp is closer to real
        const now = new Date()
        const insertDate = `${isoDate}T${now.toISOString().slice(11, 19)}`
        // Next day for open-ended date range (matches any time within the day)
        const nextDay = new Date(isoDate)
        nextDay.setDate(nextDay.getDate() + 1)
        const nextDayStr = nextDay.toISOString().split('T')[0]

        const description = movement.description

        // Deduplication — compare only year-month-day (date is TIMESTAMPTZ).

        // 1. Skip if a bank-imported transaction with a similar description already exists
        const { data: existingBankRows } = await supabaseClient
          .from('transactions')
          .select('id, bank_description')
          .eq('user_id', userId)
          .gte('date', isoDate)
          .lt('date', nextDayStr)
          .eq('amount', absAmount)
          .not('bank_description', 'is', null)
          .limit(10)

        const bankDuplicate = existingBankRows?.some(
          row => row.bank_description && description.includes(row.bank_description)
        )

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

        if (bankDuplicate || (existingManualRows && existingManualRows.length > 0)) {
          skipped++
          const reason = bankDuplicate ? 'bank_duplicate' : 'manual_duplicate'
          skippedItems.push({ date: movement.date, description, amount: absAmount, type, reason, card: movement.card })
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
          importedItems.push({ date: movement.date, description, amount: absAmount, type })
          toAutoCategorize.push({ id: inserted.id, detail: description })
        }
      }

      // Auto-categorize via single batch call (instead of N parallel fetches)
      if (toAutoCategorize.length > 0) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!

        // Fetch user's existing categories for better keyword matching
        const { data: userCategories } = await supabaseClient
          .from('categories')
          .select('name')
          .eq('user_id', userId)
        const existingCategories = (userCategories ?? []).map((c: { name: string }) => c.name)

        await fetch(`${supabaseUrl}/functions/v1/auto-categorize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            transactions: toAutoCategorize.map(({ id, detail }) => ({
              id,
              detail: `🤖 ${detail}`,
            })),
            userId,
            existingCategories,
          }),
        }).catch(e => console.error('Batch auto-categorize error:', e))
      }

      console.log(`Bank sync complete for user ${userId}: imported=${imported}, skipped=${skipped}`)

      return new Response(
        JSON.stringify({ status: 'completed', imported, skipped, importedItems, skippedItems }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── ACTION: import-skipped ───────────────────────────────────────────────
    // Force-create transactions that were previously skipped (user chose to import them)

    if (action === 'import-skipped') {
      const { movements } = body as {
        movements: { date: string; description: string; amount: number; type: string; card?: string }[]
      }

      if (!movements || !Array.isArray(movements) || movements.length === 0) {
        return new Response(
          JSON.stringify({ error: 'movements array es requerido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
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

        await fetch(`${supabaseUrl}/functions/v1/auto-categorize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            transactions: toAutoCategorize.map(({ id, detail }) => ({
              id,
              detail: `🤖 ${detail}`,
            })),
            userId,
            existingCategories,
          }),
        }).catch(e => console.error('Batch auto-categorize error:', e))
      }

      return new Response(
        JSON.stringify({ created }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Acción inválida. Use "start", "check" o "import-skipped".' }),
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
