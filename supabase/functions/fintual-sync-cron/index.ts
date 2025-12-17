// Edge Function para cron job - sincroniza UN usuario específico
// Llamada por el cron job de Postgres con service_role key

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface FintualGoal {
  id: string
  type: string
  attributes: {
    name: string
    nav: number
    deposited: number
    profit: number
  }
  relationships?: {
    fund?: {
      data?: {
        id: string
        type: string
      }
    }
  }
}

interface FintualGoalsResponse {
  data: FintualGoal[]
  included?: Array<{
    id: string
    type: string
    attributes: {
      name: string
    }
  }>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar que viene del cron (service_role key)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')) {
      console.error('Unauthorized: Not service role')
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { user_id } = await req.json()
    
    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id requerido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('Cron: Sincronizando Fintual para usuario:', user_id)

    // Crear cliente con service_role para bypasear RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Obtener token guardado
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('fintual_tokens')
      .select('token, email')
      .eq('user_id', user_id)
      .single()

    if (tokenError || !tokenData) {
      console.log('No hay token para usuario:', user_id)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No hay token de Fintual para este usuario'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    const { token, email } = tokenData

    // Obtener goals de Fintual
    const fintualUrl = `https://fintual.cl/api/goals?user_token=${encodeURIComponent(token)}&user_email=${encodeURIComponent(email)}`
    
    const fintualResponse = await fetch(fintualUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!fintualResponse.ok) {
      console.error('Error de Fintual API para usuario:', user_id)
      
      // Si el token es inválido, marcar pero no eliminar (para revisar manualmente)
      if (fintualResponse.status === 401 || fintualResponse.status === 403) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Token inválido o expirado',
            user_id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Error consultando Fintual' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const fintualData = await fintualResponse.json() as FintualGoalsResponse

    if (!fintualData.data || fintualData.data.length === 0) {
      console.log('No hay goals para usuario:', user_id)
      
      // Actualizar última sincronización
      await supabaseClient
        .from('fintual_tokens')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('user_id', user_id)
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No hay inversiones',
          user_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Crear mapa de fondos
    const fundsMap: Record<string, string> = {}
    if (fintualData.included) {
      for (const item of fintualData.included) {
        if (item.type === 'fund') {
          fundsMap[item.id] = item.attributes.name
        }
      }
    }

    // Procesar cada goal y guardarlo
    let successCount = 0
    
    for (const goal of fintualData.data) {
      const { id, attributes, relationships } = goal
      const { name, nav, deposited, profit } = attributes
      
      const profitPercentage = deposited > 0 ? (profit / deposited) * 100 : 0
      
      let fundName = null
      if (relationships?.fund?.data?.id) {
        fundName = fundsMap[relationships.fund.data.id] || null
      }
      
      // Guardar snapshot en DB
      const { error: insertError } = await supabaseClient
        .from('fintual_investments')
        .insert({
          user_id,
          goal_id: id,
          goal_name: name,
          nav,
          deposited,
          profit,
          profit_percentage: profitPercentage,
          fund_name: fundName,
          snapshot_date: new Date().toISOString(),
        })
      
      if (!insertError) {
        successCount++
      } else {
        console.error('Error guardando investment:', insertError)
      }
    }

    console.log(`Cron: Guardados ${successCount} snapshots para usuario:`, user_id)

    // Actualizar última sincronización
    await supabaseClient
      .from('fintual_tokens')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', user_id)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${successCount} inversiones sincronizadas`,
        user_id,
        count: successCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error en cron sync:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
