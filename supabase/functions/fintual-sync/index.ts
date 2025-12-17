// Edge Function para sincronizar goals de Fintual
// Lee token guardado y obtiene datos actualizados de inversiones

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface FintualGoal {
  id: string
  type: string
  attributes: {
    name: string
    nav: number // saldo actual
    deposited: number // total depositado
    profit: number // ganancia/pérdida
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Obtener el user_id desde el JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario no autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const jwt = authHeader.replace('Bearer ', '')
    const payload = JSON.parse(atob(jwt.split('.')[1]))
    const userId = payload.sub

    console.log('Sincronizando datos de Fintual para usuario:', userId)

    // Obtener token guardado (RLS automáticamente filtra por user_id)
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('fintual_tokens')
      .select('token, email')
      .eq('user_id', userId)
      .single()

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No hay conexión con Fintual. Conecta tu cuenta primero.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    const { token, email } = tokenData

    // Obtener goals de Fintual
    const fintualUrl = `https://fintual.cl/api/goals?user_token=${encodeURIComponent(token)}&user_email=${encodeURIComponent(email)}`
    
    console.log('Consultando goals de Fintual...')
    
    const fintualResponse = await fetch(fintualUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!fintualResponse.ok) {
      const errorText = await fintualResponse.text()
      console.error('Error de Fintual API:', errorText)
      
        // Si el token es inválido, eliminar de DB
        if (fintualResponse.status === 401 || fintualResponse.status === 403) {
          await supabaseClient
            .from('fintual_tokens')
            .delete()
            .eq('user_id', userId)
          
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Token inválido o expirado. Reconecta tu cuenta de Fintual.',
            tokenExpired: true
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
      console.log('No hay goals en Fintual')
      
      // Actualizar última sincronización
      await supabaseClient
        .from('fintual_tokens')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('user_id', userId)
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No hay inversiones en Fintual',
          investments: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Procesando ${fintualData.data.length} goals...`)

    // Crear mapa de fondos (si vienen incluidos)
    const fundsMap: Record<string, string> = {}
    if (fintualData.included) {
      for (const item of fintualData.included) {
        if (item.type === 'fund') {
          fundsMap[item.id] = item.attributes.name
        }
      }
    }

    // Procesar cada goal y guardarlo
    const investments = []
    
    for (const goal of fintualData.data) {
      const { id, attributes, relationships } = goal
      const { name, nav, deposited, profit } = attributes
      
      // Calcular rentabilidad porcentual
      const profitPercentage = deposited > 0 ? (profit / deposited) * 100 : 0
      
      // Obtener nombre del fondo si aplica
      let fundName = null
      if (relationships?.fund?.data?.id) {
        fundName = fundsMap[relationships.fund.data.id] || null
      }
      
      // Guardar snapshot en DB
      const { error: insertError } = await supabaseClient
        .from('fintual_investments')
        .insert({
          user_id: userId,
          goal_id: id,
          goal_name: name,
          nav,
          deposited,
          profit,
          profit_percentage: profitPercentage,
          fund_name: fundName,
          snapshot_date: new Date().toISOString(),
        })
      
      if (insertError) {
        console.error('Error guardando investment:', insertError)
      } else {
        investments.push({
          goal_id: id,
          goal_name: name,
          nav,
          deposited,
          profit,
          profit_percentage: profitPercentage,
          fund_name: fundName,
        })
      }
    }

    console.log(`Guardados ${investments.length} snapshots exitosamente`)

    // Actualizar última sincronización
    await supabaseClient
      .from('fintual_tokens')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', userId)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${investments.length} inversiones sincronizadas`,
        investments,
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
