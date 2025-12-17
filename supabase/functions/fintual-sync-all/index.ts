// Edge Function para sincronizar TODOS los usuarios de Fintual
// Ejecutada por cron job diario a las 7:30 PM

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  let usersProcessed = 0
  let goalsSynced = 0
  let errorsCount = 0
  const errors: any[] = []

  try {
    console.log('Iniciando sincronización masiva de Fintual...')

    // Crear cliente con service_role para acceder a todos los usuarios
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Obtener todos los usuarios con token de Fintual
    const { data: users, error: usersError } = await supabase
      .from('fintual_tokens')
      .select('user_id, token, email')

    if (usersError) {
      throw new Error(`Error obteniendo usuarios: ${usersError.message}`)
    }

    if (!users || users.length === 0) {
      console.log('No hay usuarios con Fintual conectado')
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No hay usuarios para sincronizar',
          stats: { users: 0, goals: 0, errors: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Procesando ${users.length} usuarios...`)

    // Procesar cada usuario
    for (const user of users) {
      try {
        const { user_id, token, email } = user

        // Llamar a API de Fintual
        const fintualUrl = `https://fintual.cl/api/goals?user_token=${encodeURIComponent(token)}&user_email=${encodeURIComponent(email)}`
        
        const response = await fetch(fintualUrl)

        if (!response.ok) {
          console.error(`Error para usuario ${user_id}: ${response.status}`)
          errorsCount++
          errors.push({ user_id, error: `HTTP ${response.status}` })
          continue
        }

        const data = await response.json()

        if (!data.data || data.data.length === 0) {
          console.log(`Usuario ${user_id}: sin goals`)
          usersProcessed++
          continue
        }

        // Crear mapa de fondos
        const fundsMap: Record<string, string> = {}
        if (data.included) {
          for (const item of data.included) {
            if (item.type === 'fund') {
              fundsMap[item.id] = item.attributes.name
            }
          }
        }

        // Guardar cada goal
        for (const goal of data.data) {
          const { id, attributes, relationships } = goal
          const { name, nav, deposited, profit } = attributes

          const profitPercentage = deposited > 0 ? (profit / deposited) * 100 : 0
          
          let fundName = null
          if (relationships?.fund?.data?.id) {
            fundName = fundsMap[relationships.fund.data.id] || null
          }

          const { error: insertError } = await supabase
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

          if (insertError) {
            console.error(`Error guardando goal ${id}:`, insertError)
            errorsCount++
          } else {
            goalsSynced++
          }
        }

        // Actualizar última sincronización
        await supabase
          .from('fintual_tokens')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('user_id', user_id)

        usersProcessed++
        console.log(`Usuario ${user_id}: ${data.data.length} goals sincronizados`)

      } catch (userError: any) {
        console.error(`Error procesando usuario ${user.user_id}:`, userError)
        errorsCount++
        errors.push({ user_id: user.user_id, error: userError.message })
      }
    }

    const duration = Date.now() - startTime

    // Guardar log de sincronización
    await supabase
      .from('fintual_sync_log')
      .insert({
        users_synced: usersProcessed,
        goals_synced: goalsSynced,
        errors_count: errorsCount,
        duration_ms: duration,
        status: errorsCount === 0 ? 'success' : (usersProcessed > 0 ? 'partial' : 'failed'),
        error_details: errors.length > 0 ? errors : null
      })

    console.log(`Sincronización completada: ${usersProcessed} usuarios, ${goalsSynced} goals, ${errorsCount} errores en ${duration}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronización completada`,
        stats: {
          users_processed: usersProcessed,
          goals_synced: goalsSynced,
          errors: errorsCount,
          duration_ms: duration
        },
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error crítico en sincronización:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stats: {
          users_processed: usersProcessed,
          goals_synced: goalsSynced,
          errors: errorsCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
