import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { sendNotificationEmail } from '../_shared/email-notification.ts'

const walletCorsHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Headers':
    corsHeaders['Access-Control-Allow-Headers'] +
    ', comercio, cantidad, divisa, tarjeta, banco, digitos, usuario',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: walletCorsHeaders })
  }

  try {
    let comercio: string | null = null
    let cantidad: string | null = null
    let divisa: string | null = null
    let tarjeta: string | null = null
    let banco: string | null = null
    let digitos: string | null = null
    let usuario: string | null = null

    if (req.method === 'POST') {
      const body = await req.json()
      comercio = body.comercio ?? null
      cantidad = body.cantidad != null ? String(body.cantidad) : null
      divisa = body.divisa ?? null
      tarjeta = body.tarjeta ?? null
      banco = body.banco ?? null
      digitos = body.digitos != null ? String(body.digitos) : null
      usuario = body.usuario ?? null
    } else {
      // GET — read from headers (decode for special chars like tildes)
      const h = (name: string) => {
        const val = req.headers.get(name)
        return val ? decodeURIComponent(val) : null
      }
      comercio = h('comercio')
      cantidad = h('cantidad')
      divisa = h('divisa')
      tarjeta = h('tarjeta')
      banco = h('banco')
      digitos = h('digitos')
      usuario = h('usuario')
    }

    if (!comercio || !cantidad || !usuario) {
      return new Response(
        JSON.stringify({ success: false, error: 'comercio, cantidad y usuario son requeridos' }),
        { headers: { ...walletCorsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Parse amount — handle CLP format: "5.500" or "$5,500" or "5500"
    const rawAmount = cantidad.replace(/[$\s]/g, '').replace(/\./g, '').replace(/,/g, '')
    const parsedAmount = parseInt(rawAmount, 10)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: `Monto inválido: "${cantidad}"` }),
        { headers: { ...walletCorsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Build detail: "📱 Starbucks" or "📱 Starbucks (USD)"
    const divisaUpper = divisa ? divisa.toUpperCase() : 'CLP'
    const divisaSuffix = divisaUpper && divisaUpper !== 'CLP' ? ` (${divisaUpper})` : ''
    const detail = `📱 ${comercio}${divisaSuffix}`

    const bankName = banco || 'Banco'
    const transactionDate = new Date().toISOString()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Auto-categorize: check user's history for similar details
    let categoryName = 'Sin categoría'
    try {
      const searchTerm = comercio.split(/[\s(]/)[0]
      if (searchTerm && searchTerm.length > 2) {
        const { data: similar } = await supabase
          .from('transactions')
          .select('category_name')
          .eq('user_id', usuario)
          .neq('category_name', 'Sin categoría')
          .neq('category_name', '⚡ Analizando...')
          .ilike('detail', `%${searchTerm}%`)
          .limit(5)

        if (similar && similar.length > 0) {
          const counts: Record<string, number> = {}
          for (const tx of similar) {
            counts[tx.category_name] = (counts[tx.category_name] || 0) + 1
          }
          const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
          if (best) categoryName = best[0]
        }
      }
    } catch (e) {
      console.error('⚠️ Auto-categorize error:', e)
    }

    // Match credit card by last 4 digits
    let cardId: string | null = null
    if (digitos) {
      try {
        const { data: card } = await supabase
          .from('credit_cards')
          .select('id')
          .eq('user_id', usuario)
          .eq('last_4_digits', digitos)
          .eq('is_active', true)
          .maybeSingle()

        if (card) {
          cardId = card.id
          console.log(`💳 Tarjeta matched: ****${digitos} → ${card.id}`)
        }
      } catch (e) {
        console.error('⚠️ Card match error:', e)
      }
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: usuario,
        date: transactionDate,
        detail: detail,
        category_name: categoryName,
        type: 'Gasto',
        amount: parsedAmount,
        card_id: cardId,
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error al crear transacción:', error)
      throw error
    }

    console.log('✅ Transacción creada:', data.id, detail, parsedAmount)

    // Weekly stats
    let weeklyStats = null
    try {
      const now = new Date(transactionDate)
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 6)
      const weekAgoStr = weekAgo.toISOString().split('T')[0]

      const { data: weekTxns } = await supabase
        .from('transactions')
        .select('date, amount, detail')
        .eq('user_id', usuario)
        .eq('category_name', categoryName)
        .eq('type', 'Gasto')
        .gte('date', weekAgoStr)
        .order('amount', { ascending: false })

      if (weekTxns && weekTxns.length > 0) {
        const dailyTotals: { date: string; day: string; total: number }[] = []
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now)
          d.setDate(d.getDate() - i)
          const dateStr = d.toISOString().split('T')[0]
          const dayTotal = weekTxns
            .filter(t => t.date.startsWith(dateStr))
            .reduce((sum, t) => sum + t.amount, 0)
          dailyTotals.push({
            date: dateStr,
            day: dayNames[d.getDay()],
            total: dayTotal,
          })
        }

        const top3 = weekTxns.slice(0, 3).map(t => ({
          detail: t.detail.replace(/^[🤖📱]\s*/, ''),
          amount: t.amount,
        }))

        const weekTotal = weekTxns.reduce((sum, t) => sum + t.amount, 0)
        weeklyStats = { dailyTotals, top3, weekTotal, count: weekTxns.length }
      }
    } catch (e) {
      console.error('⚠️ Weekly stats error:', e)
    }

    // Web push notification
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const formatted = new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
      }).format(parsedAmount)

      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          userId: usuario,
          notification: {
            title: `💳 Gasto: ${formatted}`,
            body: detail,
            tag: 'wallet-transaction',
            requireInteraction: true,
          },
        }),
      })
    } catch (pushError) {
      console.error('⚠️ Push notification error:', pushError)
    }

    // Email notification via Resend
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(usuario)
      const userEmail = userData?.user?.email
      if (userEmail) {
        await sendNotificationEmail({
          to: userEmail,
          amount: parsedAmount,
          detail: detail,
          category: categoryName,
          bank: bankName,
          type: 'Gasto',
          weeklyStats,
        })
      } else {
        console.warn('⚠️ No email found for user', usuario)
      }
    } catch (emailError) {
      console.error('⚠️ Email notification error:', emailError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: data.id,
        parsed: {
          amount: parsedAmount,
          type: 'Gasto',
          bank: bankName,
          detail: detail,
          category: categoryName,
          weeklyStats,
        },
      }),
      { headers: { ...walletCorsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error:', error)
    let msg: string
    try {
      msg = JSON.stringify(error)
    } catch {
      msg = error instanceof Error ? error.message : String(error)
    }
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...walletCorsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
