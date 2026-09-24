// Edge Function para agregar transacciones rápidamente
// Recibe texto natural tipo "45000 sushi" y crea la transacción + auto-categoriza

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { categorizeForUser } from '../_shared/jev-poc.ts'

interface QuickAddRequest {
  text: string
  type?: 'Gasto' | 'Ingreso' | 'Inversión'
  // Auth via email/password (for Apple Shortcuts, etc.)
  email?: string
  password?: string
}

function parseInput(input: string): { amount: number; detail: string | null } | null {
  const cleaned = input.trim()
  const match = cleaned.match(/^\$?\s*([\d.,]+)\s*(.*)/)
  if (!match) return null

  const amountStr = match[1].replace(/[.,]/g, "")
  const amount = parseInt(amountStr, 10)
  if (isNaN(amount) || amount <= 0) return null

  const detail = match[2]?.trim() || null
  return { amount, detail }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as QuickAddRequest
    const { text, type = 'Gasto', email, password } = body

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    let supabaseClient: ReturnType<typeof createClient>
    let userId: string

    if (email && password) {
      // Auth via email/password (Apple Shortcuts, HTTP clients, etc.)
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
      const { data: authData, error: signInError } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError || !authData.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Email o contraseña incorrectos' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      userId = authData.user.id

      // Re-create client with the session token for RLS
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: `Bearer ${authData.session!.access_token}` },
        },
      })
    } else {
      // Auth via Bearer token (Raycast, web app, etc.)
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: 'No autorizado. Envía email+password o un Bearer token.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: authHeader },
        },
      })

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token inválido o expirado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      userId = user.id
    }

    // Parse input
    const parsed = parseInput(text)
    if (!parsed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Formato inválido. Usa: "45000 sushi" o "$12000 uber"' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const willAnalyze = parsed.detail && parsed.detail.length >= 3

    // Insert transaction
    const { data: transaction, error: insertError } = await supabaseClient
      .from('transactions')
      .insert({
        amount: parsed.amount,
        type,
        category_name: willAnalyze ? '⚡ Analizando...' : 'Sin categoría',
        detail: parsed.detail,
        date: new Date().toISOString(),
        user_id: userId,
        card_id: null,
        installment_id: null,
      })
      .select()
      .single()

    if (insertError) {
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Auto-categorize if detail is long enough
    let categorization = null
    if (willAnalyze && transaction?.id) {
      try {
        categorization = await categorizeForUser(supabaseClient, transaction.id, userId, { apiKey: Deno.env.get('AI_GATEWAY_API_KEY') ?? '' })
      } catch {
        await supabaseClient.from('transactions').update({ category_name: 'Sin categoría' })
          .eq('id', transaction.id).eq('user_id', userId).eq('category_name', '⚡ Analizando...')
      }
    }

    const formatted = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(parsed.amount)

    return new Response(
      JSON.stringify({
        success: true,
        transaction: {
          id: transaction.id,
          amount: parsed.amount,
          amountFormatted: formatted,
          type,
          detail: parsed.detail,
          category: categorization?.category ?? 'Sin categoría',
        },
        categorization,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
